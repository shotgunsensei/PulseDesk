import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PulseLoader } from "@/components/pulse-line";
import {
  Trash2,
  Shield,
  Crown,
  Zap,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Star,
  Server,
  RefreshCw,
  AlertTriangle,
  Play,
  XCircle,
  CheckCircle2,
  Inbox,
  Clock,
  Power,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="currentColor">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { PLAN_LIMITS } from "@shared/schema";

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  counts: {
    tickets: number;
    departments: number;
    assets: number;
    members: number;
  };
}

interface UserMembership {
  orgId: string;
  role: string;
  orgName: string;
  orgSlug: string;
  orgPlan: string;
}

interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: UserMembership[];
}

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "pro_plus", label: "Pro Plus" },
  { value: "enterprise", label: "Enterprise" },
  { value: "unlimited", label: "Unlimited" },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "staff", label: "Staff" },
  { value: "technician", label: "Technician" },
  { value: "readonly", label: "Read-Only" },
];

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pro_plus: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  enterprise: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  unlimited: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  supervisor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  staff: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  technician: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  readonly: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function getPlanIcon(plan: string) {
  if (plan === "unlimited") return <Crown className="h-4 w-4 text-amber-600" />;
  if (plan === "enterprise") return <Crown className="h-4 w-4 text-violet-600" />;
  if (plan === "pro_plus") return <Zap className="h-4 w-4 text-indigo-600" />;
  if (plan === "pro") return <Zap className="h-4 w-4 text-blue-600" />;
  return <Shield className="h-4 w-4 text-slate-500" />;
}

interface AdminConnector {
  id: string;
  orgId: string;
  provider: string;
  label: string;
  status: string;
  emailAddress: string | null;
  imapHost: string | null;
  lastPolledAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  emailsProcessed: number;
  enabled: boolean;
  hasCredentials: boolean;
  orgName: string;
  orgPlan: string;
  pollerRunning: boolean;
  pollerDisabled: boolean;
  createdAt: string;
}

interface ConnectorEventItem {
  id: string;
  connectorId: string;
  orgId: string;
  eventType: string;
  message: string;
  createdAt: string;
}

const PROVIDER_ICON: Record<string, any> = {
  google: SiGoogle,
  microsoft: MicrosoftIcon,
  imap: Server,
  forwarding: Inbox,
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  imap: "IMAP",
  forwarding: "Forwarding",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  pending_auth: "bg-amber-500",
  error: "bg-rose-500",
  disabled: "bg-rose-500",
};

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState<string>("all");
  const [connectorStatusFilter, setConnectorStatusFilter] = useState<string>("all");
  const [expandedConnectorEvents, setExpandedConnectorEvents] = useState<string | null>(null);

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="System Admin" description="Access restricted" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Super admin access required</p>
            <Button variant="outline" className="mt-3" onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const { data: orgs, isLoading: orgsLoading } = useQuery<AdminOrg[]>({ queryKey: ["/api/admin/orgs"] });
  const { data: adminUsers, isLoading: usersLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });
  const { data: adminConnectors } = useQuery<AdminConnector[]>({
    queryKey: ["/api/admin/connectors"],
    refetchInterval: 15000,
  });

  const { data: connectorEventsData } = useQuery<ConnectorEventItem[]>({
    queryKey: ["/api/admin/connectors", expandedConnectorEvents, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/connectors/${expandedConnectorEvents}/events?limit=30`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    enabled: !!expandedConnectorEvents,
  });

  const { data: imapDashboard } = useQuery<{
    pollers: Array<{ orgId: string; running: boolean; lastPollAt: string | null; lastError: string | null; consecutiveFailures: number; disabled: boolean; orgName: string; orgPlan: string; imapEmailsProcessed?: number }>;
    dbOnlyEnabled: Array<{ orgId: string; running: boolean; lastPollAt: string | null; lastError: string | null; consecutiveFailures: number; disabled: boolean; orgName: string; orgPlan: string; imapEmailsProcessed?: number }>;
  }>({ queryKey: ["/api/admin/imap/status"], refetchInterval: 15000 });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/orgs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Organization deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ orgId, plan }: { orgId: string; plan: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/orgs/${orgId}/plan`, { plan });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Plan updated", description: `Organization plan changed to ${data.plan}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ orgId, userId, role }: { orgId: string; userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/orgs/${orgId}/members/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      toast({ title: "Role updated", description: `User role changed to ${data.role}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminImapResetMutation = useMutation({
    mutationFn: async (orgId: string) => {
      await apiRequest("POST", `/api/admin/imap/reset/${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imap/status"] });
      toast({ title: "Poller reset" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminImapForcePollMutation = useMutation({
    mutationFn: async (orgId: string) => {
      await apiRequest("POST", `/api/admin/imap/force-poll/${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imap/status"] });
      toast({ title: "Force poll completed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminImapDisableMutation = useMutation({
    mutationFn: async (orgId: string) => {
      await apiRequest("POST", `/api/admin/imap/disable/${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imap/status"] });
      toast({ title: "IMAP disabled for organization" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminConnectorForcePollMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      await apiRequest("POST", `/api/admin/connectors/${connectorId}/force-poll`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/connectors"] });
      toast({ title: "Force poll completed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminConnectorDisableMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      await apiRequest("POST", `/api/admin/connectors/${connectorId}/disable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/connectors"] });
      toast({ title: "Connector disabled" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adminConnectorEnableMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      await apiRequest("POST", `/api/admin/connectors/${connectorId}/enable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/connectors"] });
      toast({ title: "Connector enabled" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/superadmin`, { isSuperAdmin });
      return res.json();
    },
    onSuccess: (_data: any, vars: { userId: string; isSuperAdmin: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: vars.isSuperAdmin ? "Super admin granted" : "Super admin revoked" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="System Admin" description="Manage all organizations, plans, and user roles across tenants" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">

        <Card data-testid="card-admin-orgs">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizations ({orgs?.length || 0})
            </CardTitle>
            <CardDescription>Manage subscription plans and organization settings</CardDescription>
          </CardHeader>
          <CardContent>
            {orgsLoading ? (
              <div className="flex items-center justify-center py-8"><PulseLoader /></div>
            ) : !orgs || orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organizations</p>
            ) : (
              <div className="space-y-2">
                {orgs.map((o) => {
                  const isExpanded = expandedOrg === o.id;
                  const planLimits = PLAN_LIMITS[o.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
                  return (
                    <div key={o.id} className="rounded-lg border" data-testid={`admin-org-${o.id}`}>
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedOrg(isExpanded ? null : o.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{o.name}</p>
                            <Badge className={`text-[10px] ${PLAN_BADGE_STYLES[o.plan] || PLAN_BADGE_STYLES.free}`} variant="secondary">
                              {getPlanIcon(o.plan)}
                              <span className="ml-1">{planLimits.label}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {o.slug} · {o.memberCount} members · {o.counts.tickets} tickets
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${o.name}" and all its data?`)) deleteOrgMutation.mutate(o.id); }}
                          data-testid={`button-delete-org-${o.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-3 py-3 bg-muted/10 space-y-3">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground w-24 shrink-0">Subscription</label>
                            <Select
                              value={o.plan}
                              onValueChange={(plan) => {
                                if (plan !== o.plan && confirm(`Change "${o.name}" from ${o.plan} to ${plan}?`)) {
                                  updatePlanMutation.mutate({ orgId: o.id, plan });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-48" data-testid={`select-plan-${o.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_OPTIONS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                    {p.value !== "free" && ` ($${PLAN_LIMITS[p.value as keyof typeof PLAN_LIMITS]?.price}/mo)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="rounded border p-2">
                              <span className="text-muted-foreground">Members</span>
                              <p className="font-medium">{o.memberCount} / {planLimits.maxMembers === Infinity ? "∞" : planLimits.maxMembers}</p>
                            </div>
                            <div className="rounded border p-2">
                              <span className="text-muted-foreground">Tickets</span>
                              <p className="font-medium">{o.counts.tickets}</p>
                            </div>
                            <div className="rounded border p-2">
                              <span className="text-muted-foreground">Entra SSO</span>
                              <p className="font-medium">{planLimits.entraEnabled ? "Yes" : "No"}</p>
                            </div>
                            <div className="rounded border p-2">
                              <span className="text-muted-foreground">Email-to-Ticket</span>
                              <p className="font-medium">{planLimits.emailToTicket ? "Yes" : "No"}</p>
                            </div>
                          </div>
                          {o.stripeCustomerId && (
                            <p className="text-[11px] text-muted-foreground">
                              Stripe: {o.stripeCustomerId}
                              {o.stripeSubscriptionId && ` · Sub: ${o.stripeSubscriptionId}`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-admin-users">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users ({adminUsers?.length || 0})
            </CardTitle>
            <CardDescription>Manage user roles across organizations and super admin access</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8"><PulseLoader /></div>
            ) : !adminUsers || adminUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users</p>
            ) : (
              <div className="space-y-2">
                {adminUsers.map((u) => {
                  const isExpanded = expandedUser === u.id;
                  const isSelf = u.id === user?.id;
                  return (
                    <div key={u.id} className="rounded-lg border" data-testid={`admin-user-${u.id}`}>
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {u.fullName}
                              <span className="text-muted-foreground font-normal ml-1">@{u.username}</span>
                            </p>
                            {u.isSuperAdmin && (
                              <Badge className="text-[10px] bg-primary/10 text-primary" variant="secondary">
                                <Star className="h-3 w-3 mr-0.5" />
                                Super Admin
                              </Badge>
                            )}
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px]">You</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {u.email || "No email"} · {u.memberships.length} org{u.memberships.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-3 py-3 bg-muted/10 space-y-3">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground w-24 shrink-0">Super Admin</label>
                            <Button
                              variant={u.isSuperAdmin ? "destructive" : "outline"}
                              size="sm"
                              className="text-xs h-7"
                              disabled={isSelf || toggleSuperAdminMutation.isPending}
                              onClick={() => {
                                const action = u.isSuperAdmin ? "revoke" : "grant";
                                if (confirm(`${action === "grant" ? "Grant" : "Revoke"} super admin for ${u.fullName}?`)) {
                                  toggleSuperAdminMutation.mutate({ userId: u.id, isSuperAdmin: !u.isSuperAdmin });
                                }
                              }}
                              data-testid={`button-toggle-superadmin-${u.id}`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {u.isSuperAdmin ? "Revoke Super Admin" : "Grant Super Admin"}
                            </Button>
                            {isSelf && <span className="text-[11px] text-muted-foreground">(Cannot modify own status)</span>}
                          </div>

                          {u.memberships.length > 0 ? (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Organization Memberships</p>
                              <div className="space-y-2">
                                {u.memberships.map((m) => (
                                  <div key={m.orgId} className="flex items-center gap-3 rounded border p-2.5 bg-background" data-testid={`membership-${u.id}-${m.orgId}`}>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{m.orgName}</span>
                                        <Badge className={`text-[10px] ${PLAN_BADGE_STYLES[m.orgPlan] || PLAN_BADGE_STYLES.free}`} variant="secondary">
                                          {m.orgPlan}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={m.role}
                                        onValueChange={(role) => {
                                          if (role !== m.role && confirm(`Change ${u.fullName}'s role in "${m.orgName}" from ${m.role} to ${role}?`)) {
                                            updateRoleMutation.mutate({ orgId: m.orgId, userId: u.id, role });
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-role-${u.id}-${m.orgId}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ROLE_OPTIONS.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No organization memberships</p>
                          )}

                          <p className="text-[11px] text-muted-foreground">
                            Joined: {new Date(u.createdAt).toLocaleDateString()} · ID: {u.id.slice(0, 8)}...
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-admin-connectors">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Mail Connector Dashboard
            </CardTitle>
            <CardDescription>Monitor and manage all mail connectors across tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Select value={connectorFilter} onValueChange={setConnectorFilter}>
                <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-connector-provider-filter">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="microsoft">Microsoft</SelectItem>
                  <SelectItem value="imap">IMAP</SelectItem>
                  <SelectItem value="forwarding">Forwarding</SelectItem>
                </SelectContent>
              </Select>
              <Select value={connectorStatusFilter} onValueChange={setConnectorStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-connector-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending_auth">Pending Auth</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">
                {adminConnectors?.length || 0} total connectors
              </span>
            </div>

            {(() => {
              let filtered = adminConnectors || [];
              if (connectorFilter !== "all") {
                filtered = filtered.filter(c => c.provider === connectorFilter);
              }
              if (connectorStatusFilter !== "all") {
                if (connectorStatusFilter === "error") {
                  filtered = filtered.filter(c => c.status === "error" || c.consecutiveFailures > 0);
                } else if (connectorStatusFilter === "disabled") {
                  filtered = filtered.filter(c => !c.enabled || c.status === "disabled");
                } else {
                  filtered = filtered.filter(c => c.status === connectorStatusFilter);
                }
              }

              if (filtered.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No connectors found</p>;
              }

              return (
                <div className="space-y-2">
                  {filtered.map((c) => {
                    const ProviderIcon = PROVIDER_ICON[c.provider] || Server;
                    const isEventsExpanded = expandedConnectorEvents === c.id;
                    return (
                      <div key={c.id} className="rounded-lg border" data-testid={`admin-connector-${c.id}`}>
                        <div className="flex items-center gap-3 p-3">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            c.enabled && c.status === "active" && c.consecutiveFailures === 0 ? "bg-emerald-500 animate-pulse" :
                            c.consecutiveFailures > 0 ? "bg-amber-500" :
                            c.status === "error" || c.status === "disabled" || !c.enabled ? "bg-rose-500" :
                            c.status === "pending_auth" ? "bg-amber-500" :
                            "bg-slate-400"
                          }`} />
                          <ProviderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{c.orgName}</span>
                              <Badge className={`text-[10px] ${PLAN_BADGE_STYLES[c.orgPlan] || PLAN_BADGE_STYLES.free}`} variant="secondary">
                                {c.orgPlan}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {PROVIDER_LABEL[c.provider] || c.provider}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${
                                c.status === "active" && c.enabled ? "border-emerald-300 text-emerald-600" :
                                c.status === "error" ? "border-rose-300 text-rose-600" :
                                c.status === "pending_auth" ? "border-amber-300 text-amber-600" :
                                ""
                              }`}>
                                {!c.enabled ? "Disabled" : c.status === "active" ? "Active" : c.status === "pending_auth" ? "Pending Auth" : c.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {c.emailAddress || c.imapHost || "No address"}
                              {' · '}Last sync: {c.lastPolledAt ? new Date(c.lastPolledAt).toLocaleString() : "Never"}
                              {' · '}{c.emailsProcessed} emails
                              {c.consecutiveFailures > 0 && ` · ${c.consecutiveFailures} failures`}
                            </p>
                            {c.lastError && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                                <span className="text-[11px] text-rose-600 truncate">{c.lastError}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {c.provider !== "forwarding" && c.status === "active" && (
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => adminConnectorForcePollMutation.mutate(c.id)} disabled={adminConnectorForcePollMutation.isPending} data-testid={`button-admin-connector-poll-${c.id}`}>
                                <Play className="h-3 w-3" /> Poll
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setExpandedConnectorEvents(isEventsExpanded ? null : c.id)} data-testid={`button-admin-connector-events-${c.id}`}>
                              <Clock className="h-3 w-3" /> Events
                            </Button>
                            {c.enabled ? (
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-rose-600 hover:text-rose-700" onClick={() => adminConnectorDisableMutation.mutate(c.id)} disabled={adminConnectorDisableMutation.isPending} data-testid={`button-admin-connector-disable-${c.id}`}>
                                <XCircle className="h-3 w-3" /> Disable
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-emerald-600 hover:text-emerald-700" onClick={() => adminConnectorEnableMutation.mutate(c.id)} disabled={adminConnectorEnableMutation.isPending} data-testid={`button-admin-connector-enable-${c.id}`}>
                                <Power className="h-3 w-3" /> Enable
                              </Button>
                            )}
                          </div>
                        </div>
                        {isEventsExpanded && (
                          <div className="border-t px-3 py-3 bg-muted/10 space-y-1.5 max-h-60 overflow-auto">
                            {!connectorEventsData || connectorEventsData.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">No events</p>
                            ) : (
                              connectorEventsData.map((evt) => (
                                <div key={evt.id} className="flex items-start gap-2 text-[11px]" data-testid={`admin-event-${evt.id}`}>
                                  <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                                    {evt.eventType}
                                  </Badge>
                                  <span className="flex-1 text-muted-foreground">{evt.message}</span>
                                  <span className="text-muted-foreground/60 shrink-0">{new Date(evt.createdAt).toLocaleString()}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {(() => {
              const allPollers = [
                ...(imapDashboard?.pollers || []),
                ...(imapDashboard?.dbOnlyEnabled || []),
              ];
              if (allPollers.length === 0) return null;

              return (
                <div className="mt-6">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Server className="h-3 w-3" /> Legacy IMAP Pollers
                  </p>
                  <div className="space-y-2">
                    {allPollers.map((p) => (
                      <div key={p.orgId} className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 p-3" data-testid={`imap-poller-${p.orgId}`}>
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.running ? "bg-emerald-500 animate-pulse" : p.disabled ? "bg-rose-500" : "bg-slate-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.orgName}</span>
                            <Badge className={`text-[10px] ${PLAN_BADGE_STYLES[p.orgPlan] || PLAN_BADGE_STYLES.free}`} variant="secondary">{p.orgPlan}</Badge>
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Legacy</Badge>
                            <Badge variant="outline" className="text-[10px]">{p.running ? "Running" : p.disabled ? "Disabled" : "Stopped"}</Badge>
                          </div>
                          {p.lastError && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                              <span className="text-[11px] text-rose-600 truncate">{p.lastError}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">({p.consecutiveFailures} failures)</span>
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Last poll: {p.lastPollAt ? new Date(p.lastPollAt).toLocaleString() : "Never"}
                            {' · '}{p.imapEmailsProcessed || 0} emails
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => adminImapForcePollMutation.mutate(p.orgId)} disabled={adminImapForcePollMutation.isPending} data-testid={`button-admin-imap-force-poll-${p.orgId}`}>
                            <Play className="h-3 w-3" /> Poll
                          </Button>
                          {(p.disabled || p.consecutiveFailures > 0) && (
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => adminImapResetMutation.mutate(p.orgId)} disabled={adminImapResetMutation.isPending} data-testid={`button-admin-imap-reset-${p.orgId}`}>
                              <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                          )}
                          {!p.disabled && (
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-rose-600 hover:text-rose-700" onClick={() => adminImapDisableMutation.mutate(p.orgId)} disabled={adminImapDisableMutation.isPending} data-testid={`button-admin-imap-disable-${p.orgId}`}>
                              <XCircle className="h-3 w-3" /> Disable
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
