import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PulseLoader } from "@/components/pulse-line";
import {
  Mail,
  Copy,
  Check,
  Lock,
  Sparkles,
  Send,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  MailPlus,
  ArrowRight,
  RefreshCw,
  Server,
  Plug,
  Power,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { PLAN_LIMITS } from "@shared/schema";
import { canManageSettings } from "@/lib/permissions";
import { Link } from "wouter";

interface EmailSettingsData {
  id: string;
  orgId: string;
  inboundAlias: string;
  enabled: boolean;
  defaultDepartmentId: string | null;
  defaultAssigneeId: string | null;
  allowedSenderDomains: string[] | null;
  autoCreateContacts: boolean;
  appendRepliesToTickets: boolean;
  unknownSenderAction: string;
}

interface InboundEvent {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  status: string;
  statusReason: string;
  ticketId: string | null;
  createdAt: string;
}

interface ImapStatus {
  configured: boolean;
  imapHost: string | null;
  imapPort: number;
  imapUser: string | null;
  imapTls: boolean;
  imapEnabled: boolean;
  imapPollIntervalSeconds: number;
  imapFolder: string;
  imapLastPolledAt: string | null;
  imapLastError: string | null;
  imapConsecutiveFailures: number;
  imapEmailsProcessed: number;
  pollerRunning: boolean;
  pollerDisabled: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface MemberWithUser {
  userId: string;
  role: string;
  user: { id: string; fullName: string; username: string } | null;
}

const STATUS_ICON: Record<string, any> = {
  created: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  threaded: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
  rejected: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
  failed: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  accepted: { icon: Check, color: "text-sky-600", bg: "bg-sky-50" },
};

export default function EmailSettingsPage() {
  const { membership } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [domainsInput, setDomainsInput] = useState("");
  const [testForm, setTestForm] = useState({ fromEmail: "", fromName: "", subject: "", body: "" });
  const [imapForm, setImapForm] = useState({ imapHost: "", imapPort: 993, imapUser: "", imapPassword: "", imapTls: true, imapPollIntervalSeconds: 120, imapFolder: "INBOX" });
  const [showImapPassword, setShowImapPassword] = useState(false);

  const isAdmin = membership && canManageSettings(membership.role);

  const { data: settingsResponse, isLoading } = useQuery<{
    eligible: boolean;
    plan: string;
    settings: EmailSettingsData | null;
  }>({
    queryKey: ["/api/email/settings"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: !!settingsResponse?.eligible,
  });

  const { data: members } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/orgs/members"],
    enabled: !!settingsResponse?.eligible,
  });

  const { data: events } = useQuery<InboundEvent[]>({
    queryKey: ["/api/email/events"],
    enabled: !!settingsResponse?.eligible && !!settingsResponse?.settings,
  });

  const { data: imapStatus } = useQuery<ImapStatus>({
    queryKey: ["/api/email/imap/status"],
    enabled: !!settingsResponse?.eligible && !!settingsResponse?.settings,
    refetchInterval: 30000,
  });

  const initMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/email/settings/initialize"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/settings"] });
      toast({ title: "Email-to-Ticket activated", description: "Your inbound email address has been created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EmailSettingsData>) => apiRequest("PATCH", "/api/email/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/email/test-inbound", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/events"] });
      toast({ title: `Test result: ${data.status}`, description: data.reason || data.statusReason });
    },
    onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const imapConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/email/imap/configure", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/imap/status"] });
      toast({ title: "IMAP configuration saved" });
      setImapForm(f => ({ ...f, imapPassword: "" }));
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const imapToggleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/email/imap", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/imap/status"] });
      toast({ title: "IMAP polling updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const imapTestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/email/imap/test", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Connection successful", description: `Mailbox: ${data.mailboxInfo?.exists || 0} messages, ${data.mailboxInfo?.unseen || 0} unseen` });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const imapResetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/email/imap/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/imap/status"] });
      toast({ title: "Poller reset", description: "IMAP poller has been reset and restarted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <PulseLoader />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Email-to-Ticket" description="Inbound email automation" />
        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-lg mx-auto text-center p-8">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
            <p className="text-sm text-muted-foreground">Only administrators can manage Email-to-Ticket settings.</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!settingsResponse?.eligible) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Email-to-Ticket" description="Inbound email automation" />
        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-xl mx-auto" data-testid="email-locked-card">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground mb-4">
                Email-to-Ticket automation is available on <strong>Enterprise</strong> and <strong>Unlimited</strong> plans.
                Automatically convert inbound emails into support tickets with intelligent threading and routing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                  <MailPlus className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">Dedicated inbound email address per organization</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                  <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">Automatic reply threading into existing tickets</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">Sender domain allowlists and abuse protection</span>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                  <Send className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">Auto-create contacts from inbound senders</span>
                </div>
              </div>
              <Link href="/billing">
                <Button data-testid="button-upgrade-email" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  View Plans & Upgrade
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const settings = settingsResponse.settings;
  const inboundAddress = settings ? `${settings.inboundAlias}@pulsedesk.support` : null;

  const handleCopy = () => {
    if (inboundAddress) {
      navigator.clipboard.writeText(inboundAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  const handleSaveDomains = () => {
    const domains = domainsInput.split(",").map(d => d.trim()).filter(Boolean);
    updateMutation.mutate({ allowedSenderDomains: domains } as any);
  };

  if (!settings) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Email-to-Ticket" description="Inbound email automation" />
        <div className="flex-1 overflow-auto p-6">
          <Card className="max-w-xl mx-auto text-center" data-testid="email-init-card">
            <CardContent className="p-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Set Up Email-to-Ticket</h3>
              <p className="text-muted-foreground mb-6">
                Get a dedicated email address for your organization. Emails sent to this address will automatically create support tickets.
              </p>
              <Button
                data-testid="button-activate-email"
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                size="lg"
                className="gap-2"
              >
                <MailPlus className="h-4 w-4" />
                {initMutation.isPending ? "Setting up..." : "Activate Email-to-Ticket"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Email-to-Ticket" description="Manage inbound email settings and automation" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card data-testid="card-inbound-address">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Inbound Email Address
              </CardTitle>
              <CardDescription>Emails sent to this address will create tickets in your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <code className="flex-1 text-sm font-mono" data-testid="text-inbound-address">{inboundAddress}</code>
                <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="button-copy-address">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this address with your team or configure it as a forwarding destination in your email system.
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-email-toggle">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Feature Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Email-to-Ticket</Label>
                  <p className="text-xs text-muted-foreground">Accept inbound emails and create tickets</p>
                </div>
                <Switch
                  data-testid="switch-email-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateMutation.mutate({ enabled: checked } as any)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-create Contacts</Label>
                  <p className="text-xs text-muted-foreground">Create contact records for new senders</p>
                </div>
                <Switch
                  data-testid="switch-auto-contacts"
                  checked={settings.autoCreateContacts}
                  onCheckedChange={(checked) => updateMutation.mutate({ autoCreateContacts: checked } as any)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Thread Replies</Label>
                  <p className="text-xs text-muted-foreground">Append email replies to existing ticket threads</p>
                </div>
                <Switch
                  data-testid="switch-thread-replies"
                  checked={settings.appendRepliesToTickets}
                  onCheckedChange={(checked) => updateMutation.mutate({ appendRepliesToTickets: checked } as any)}
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-email-routing">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Routing & Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Department</Label>
                <Select
                  value={settings.defaultDepartmentId || "none"}
                  onValueChange={(val) => updateMutation.mutate({ defaultDepartmentId: val === "none" ? null : val } as any)}
                >
                  <SelectTrigger className="mt-1" data-testid="select-default-dept">
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Assignee</Label>
                <Select
                  value={settings.defaultAssigneeId || "none"}
                  onValueChange={(val) => updateMutation.mutate({ defaultAssigneeId: val === "none" ? null : val } as any)}
                >
                  <SelectTrigger className="mt-1" data-testid="select-default-assignee">
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members?.filter(m => m.user).map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.user!.fullName || m.user!.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unknown Sender Behavior</Label>
                <Select
                  value={settings.unknownSenderAction}
                  onValueChange={(val) => updateMutation.mutate({ unknownSenderAction: val } as any)}
                >
                  <SelectTrigger className="mt-1" data-testid="select-unknown-sender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_ticket">Create ticket (default)</SelectItem>
                    <SelectItem value="reject">Reject email</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">What to do when an email arrives from an unknown sender</p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-sender-domains">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Allowed Sender Domains
              </CardTitle>
              <CardDescription>Only accept emails from these domains. Leave empty to accept all.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.allowedSenderDomains && settings.allowedSenderDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {settings.allowedSenderDomains.map((d, i) => (
                    <Badge key={i} variant="secondary">{d}</Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  data-testid="input-sender-domains"
                  value={domainsInput}
                  onChange={(e) => setDomainsInput(e.target.value)}
                  placeholder="example.com, hospital.org"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSaveDomains} data-testid="button-save-domains">Save</Button>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-test-inbound">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                Test Inbound Email
              </CardTitle>
              <CardDescription>Simulate an inbound email to verify your configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From Email *</Label>
                  <Input
                    data-testid="input-test-from"
                    value={testForm.fromEmail}
                    onChange={(e) => setTestForm({ ...testForm, fromEmail: e.target.value })}
                    placeholder="sender@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input
                    data-testid="input-test-name"
                    value={testForm.fromName}
                    onChange={(e) => setTestForm({ ...testForm, fromName: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Subject *</Label>
                <Input
                  data-testid="input-test-subject"
                  value={testForm.subject}
                  onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
                  placeholder="Equipment malfunction in Room 301"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Body</Label>
                <textarea
                  data-testid="input-test-body"
                  value={testForm.body}
                  onChange={(e) => setTestForm({ ...testForm, body: e.target.value })}
                  placeholder="Describe the issue..."
                  className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button
                data-testid="button-send-test"
                onClick={() => testMutation.mutate(testForm)}
                disabled={testMutation.isPending || !testForm.fromEmail || !testForm.subject}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {testMutation.isPending ? "Sending..." : "Send Test Email"}
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="card-imap-config">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                IMAP Mailbox Polling
              </CardTitle>
              <CardDescription>Connect your own mailbox to automatically poll for new emails instead of using webhooks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {imapStatus?.configured && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${imapStatus.imapEnabled && !imapStatus.pollerDisabled ? "bg-emerald-500 animate-pulse" : imapStatus.pollerDisabled ? "bg-rose-500" : "bg-slate-400"}`} />
                      <div>
                        <p className="text-sm font-medium">
                          {imapStatus.imapEnabled && !imapStatus.pollerDisabled ? "Polling Active" : imapStatus.pollerDisabled ? "Auto-Disabled" : "Polling Paused"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {imapStatus.imapUser}@{imapStatus.imapHost}:{imapStatus.imapPort}
                          {imapStatus.imapTls ? " (TLS)" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {imapStatus.pollerDisabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => imapResetMutation.mutate()}
                          disabled={imapResetMutation.isPending}
                          data-testid="button-imap-reset"
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reset
                        </Button>
                      )}
                      <Switch
                        data-testid="switch-imap-enabled"
                        checked={imapStatus.imapEnabled}
                        onCheckedChange={(checked) => imapToggleMutation.mutate({ imapEnabled: checked })}
                        disabled={imapToggleMutation.isPending}
                      />
                    </div>
                  </div>

                  {imapStatus.imapLastError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20">
                      <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Last Error ({imapStatus.imapConsecutiveFailures} failures)</p>
                        <p className="text-xs text-rose-600 dark:text-rose-400">{imapStatus.imapLastError}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded border p-2">
                      <span className="text-muted-foreground">Last Polled</span>
                      <p className="font-medium">{imapStatus.imapLastPolledAt ? new Date(imapStatus.imapLastPolledAt).toLocaleString() : "Never"}</p>
                    </div>
                    <div className="rounded border p-2">
                      <span className="text-muted-foreground">Poll Interval</span>
                      <p className="font-medium">{imapStatus.imapPollIntervalSeconds || 120}s</p>
                    </div>
                    <div className="rounded border p-2">
                      <span className="text-muted-foreground">Folder</span>
                      <p className="font-medium">{imapStatus.imapFolder || "INBOX"}</p>
                    </div>
                    <div className="rounded border p-2">
                      <span className="text-muted-foreground">Emails Processed</span>
                      <p className="font-medium">{imapStatus.imapEmailsProcessed || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{imapStatus?.configured ? "Update IMAP Connection" : "Configure IMAP Connection"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>IMAP Host *</Label>
                    <Input
                      data-testid="input-imap-host"
                      value={imapForm.imapHost}
                      onChange={(e) => setImapForm({ ...imapForm, imapHost: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input
                      data-testid="input-imap-port"
                      type="number"
                      value={imapForm.imapPort}
                      onChange={(e) => setImapForm({ ...imapForm, imapPort: parseInt(e.target.value) || 993 })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Username / Email *</Label>
                  <Input
                    data-testid="input-imap-user"
                    value={imapForm.imapUser}
                    onChange={(e) => setImapForm({ ...imapForm, imapUser: e.target.value })}
                    placeholder="support@yourdomain.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password *</Label>
                  <div className="relative mt-1">
                    <Input
                      data-testid="input-imap-password"
                      type={showImapPassword ? "text" : "password"}
                      value={imapForm.imapPassword}
                      onChange={(e) => setImapForm({ ...imapForm, imapPassword: e.target.value })}
                      placeholder={imapStatus?.configured ? "••••••••  (leave blank to keep existing)" : "App password or IMAP password"}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowImapPassword(!showImapPassword)}
                    >
                      {showImapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid="switch-imap-tls"
                      checked={imapForm.imapTls}
                      onCheckedChange={(checked) => setImapForm({ ...imapForm, imapTls: checked })}
                    />
                    <Label>Use TLS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Poll every</Label>
                    <Select
                      value={String(imapForm.imapPollIntervalSeconds)}
                      onValueChange={(val) => setImapForm({ ...imapForm, imapPollIntervalSeconds: parseInt(val) })}
                    >
                      <SelectTrigger className="w-28" data-testid="select-imap-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60s</SelectItem>
                        <SelectItem value="120">2 min</SelectItem>
                        <SelectItem value="300">5 min</SelectItem>
                        <SelectItem value="600">10 min</SelectItem>
                        <SelectItem value="900">15 min</SelectItem>
                        <SelectItem value="1800">30 min</SelectItem>
                        <SelectItem value="3600">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mailbox Folder</Label>
                    <Input
                      data-testid="input-imap-folder"
                      value={imapForm.imapFolder}
                      onChange={(e) => setImapForm({ ...imapForm, imapFolder: e.target.value })}
                      placeholder="INBOX"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="button-imap-test"
                    variant="outline"
                    onClick={() => imapTestMutation.mutate({
                      imapHost: imapForm.imapHost || imapStatus?.imapHost,
                      imapPort: imapForm.imapPort || imapStatus?.imapPort,
                      imapUser: imapForm.imapUser || imapStatus?.imapUser,
                      imapPassword: imapForm.imapPassword || undefined,
                      imapTls: imapForm.imapTls,
                    })}
                    disabled={imapTestMutation.isPending || !(imapForm.imapHost || imapStatus?.imapHost)}
                    className="gap-1"
                  >
                    {imapTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    Test Connection
                  </Button>
                  <Button
                    data-testid="button-imap-save"
                    onClick={() => imapConfigMutation.mutate(imapForm)}
                    disabled={imapConfigMutation.isPending || !imapForm.imapHost || !imapForm.imapUser || (!imapForm.imapPassword && !imapStatus?.configured)}
                    className="gap-1"
                  >
                    {imapConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    {imapStatus?.configured ? "Update Configuration" : "Save Configuration"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-email-events">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Inbound Events
              </CardTitle>
              <CardDescription>Processing history for inbound emails</CardDescription>
            </CardHeader>
            <CardContent>
              {!events || events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No inbound email events yet</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => {
                    const statusInfo = STATUS_ICON[event.status] || STATUS_ICON.failed;
                    const Icon = statusInfo.icon;
                    return (
                      <div key={event.id} className={`flex items-start gap-3 p-3 rounded-lg ${statusInfo.bg}`} data-testid={`event-${event.id}`}>
                        <Icon className={`h-4 w-4 mt-0.5 ${statusInfo.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{event.subject || "(no subject)"}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{event.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From: {event.fromName || event.fromEmail} &middot; {new Date(event.createdAt).toLocaleString()}
                          </p>
                          {event.statusReason && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.statusReason}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>1.</strong> Copy your inbound email address above.</p>
              <p><strong>2.</strong> In your organization's email system, set up a forwarding rule to send support-related emails to this address.</p>
              <p><strong>3.</strong> Optionally, configure allowed sender domains to restrict who can create tickets via email.</p>
              <p><strong>4.</strong> Use the test tool above to verify everything is working before going live.</p>
              <p><strong>5.</strong> Replies to ticket notification emails will automatically thread back into the original ticket using email headers.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
