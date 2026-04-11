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
} from "lucide-react";
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

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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
  const { data: imapDashboard } = useQuery<{
    pollers: Array<{ orgId: string; running: boolean; lastPollAt: string | null; lastError: string | null; consecutiveFailures: number; disabled: boolean; orgName: string; orgPlan: string }>;
    dbOnlyEnabled: Array<{ orgId: string; running: boolean; lastPollAt: string | null; lastError: string | null; consecutiveFailures: number; disabled: boolean; orgName: string; orgPlan: string }>;
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

        <Card data-testid="card-admin-imap">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              IMAP Polling Dashboard
            </CardTitle>
            <CardDescription>Monitor and manage per-tenant IMAP mailbox polling</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const allPollers = [
                ...(imapDashboard?.pollers || []),
                ...(imapDashboard?.dbOnlyEnabled || []),
              ];

              if (allPollers.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No IMAP pollers configured</p>;
              }

              return (
                <div className="space-y-2">
                  {allPollers.map((p) => (
                    <div key={p.orgId} className="flex items-center gap-3 rounded-lg border p-3" data-testid={`imap-poller-${p.orgId}`}>
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.running ? "bg-emerald-500 animate-pulse" : p.disabled ? "bg-rose-500" : "bg-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.orgName}</span>
                          <Badge className={`text-[10px] ${PLAN_BADGE_STYLES[p.orgPlan] || PLAN_BADGE_STYLES.free}`} variant="secondary">
                            {p.orgPlan}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {p.running ? "Running" : p.disabled ? "Disabled" : "Stopped"}
                          </Badge>
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
                        </p>
                      </div>
                      {(p.disabled || p.consecutiveFailures > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => adminImapResetMutation.mutate(p.orgId)}
                          disabled={adminImapResetMutation.isPending}
                          data-testid={`button-admin-imap-reset-${p.orgId}`}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reset
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
