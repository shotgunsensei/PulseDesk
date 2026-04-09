import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PulseLoader } from "@/components/pulse-line";
import {
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Cpu,
  Wrench,
  Package,
  TrendingUp,
  Activity,
  ChevronRight,
  Users,
  Timer,
  ShieldAlert,
  HeartPulse,
  Hourglass,
  Bell,
  UserX,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
} from "@shared/schema";
import { canSubmitIssues, isReadOnly } from "@/lib/permissions";

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedThisMonth: number;
  newThisMonth: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  overdueCount: number;
  equipmentIncidents: number;
  facilityIncidents: number;
  pendingSupplyRequests: number;
  totalAssets: number;
  assetsUnderService: number;
  assetsOffline: number;
  criticalHighOpen: number;
  waitingDeptCount: number;
  waitingVendorCount: number;
  escalatedCount: number;
  patientImpactingCount: number;
  recurringCount: number;
  unassignedCount: number;
  avgResolutionHours: number;
  avgTriageHours: number;
  agingBuckets: { under24h: number; "1to3days": number; "3to7days": number; over7days: number };
  openFacilityRequests: number;
  recentActivity: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    updatedAt: string;
    assignedToName: string | null;
  }>;
  isEmpty: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, iconColor = "text-muted-foreground", href, alert }: {
  label: string; value: number | string; sub?: string;
  icon: any; iconColor?: string; href?: string; alert?: boolean;
}) {
  const hasValue = typeof value === "number" ? value > 0 : !!value;
  const inner = (
    <div className={`rounded-xl border p-4 ${href ? "hover-elevate cursor-pointer" : ""} ${alert ? "border-rose-200 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20" : "bg-card"}`}
      data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-medium tracking-wide uppercase ${alert ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>{label}</span>
        <div className="relative">
          <Icon className={`h-4 w-4 ${alert ? "text-rose-500" : iconColor}`} />
          {alert && hasValue && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 pulse-dot-critical" />
          )}
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${alert ? "text-rose-700 dark:text-rose-400" : ""}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${alert ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function EmptyState() {
  const steps = [
    { label: "Report your first issue", href: "/submit" },
    { label: "Configure departments", href: "/departments" },
    { label: "Register equipment", href: "/assets" },
    { label: "Add vendor contacts", href: "/vendors" },
  ];

  return (
    <Card data-testid="empty-state">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Welcome to PulseDesk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Set up your facility's operational workflow with these steps.
        </p>
        <div className="space-y-2">
          {steps.map((s) => (
            <Link key={s.label} href={s.href}>
              <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 shrink-0 border-border" />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { org, membership } = useAuth();
  const role = membership?.role;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: !!org,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Dashboard" description="Loading operational data..." />
        <div className="flex-1 flex items-center justify-center">
          <PulseLoader />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        description={org ? `${org.name} — operational overview` : "Facility operations at a glance"}
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Intake" value={stats.statusCounts.new || 0} sub="awaiting triage" icon={Ticket} iconColor="text-primary" href="/tickets?status=new" />
          <KpiCard label="Open Issues" value={stats.openTickets} sub="active" icon={Activity} iconColor="text-accent" href="/tickets" />
          <KpiCard label="Overdue" value={stats.overdueCount} sub={stats.overdueCount > 0 ? "requires attention" : "all current"} icon={AlertTriangle} alert={stats.overdueCount > 0} />
          <KpiCard label="Critical / High" value={stats.criticalHighOpen} sub="unresolved" icon={ShieldAlert} iconColor="text-amber-600" alert={stats.criticalHighOpen > 3} />
          <KpiCard label="Resolved" value={stats.resolvedThisMonth} sub="this month" icon={CheckCircle2} iconColor="text-emerald-600" />
        </div>

        {stats.isEmpty && <EmptyState />}

        {(stats.waitingDeptCount > 0 || stats.waitingVendorCount > 0 || stats.escalatedCount > 0 || stats.patientImpactingCount > 0 || stats.unassignedCount > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.waitingDeptCount > 0 && (
              <KpiCard label="Dept. Pending" value={stats.waitingDeptCount} icon={Hourglass} iconColor="text-violet-600" href="/tickets?status=waiting_department" />
            )}
            {stats.waitingVendorCount > 0 && (
              <KpiCard label="Vendor Pending" value={stats.waitingVendorCount} icon={Users} iconColor="text-fuchsia-600" href="/tickets?status=waiting_vendor" />
            )}
            {stats.escalatedCount > 0 && (
              <KpiCard label="Escalated" value={stats.escalatedCount} icon={Bell} iconColor="text-rose-600" href="/tickets?status=escalated" />
            )}
            {stats.patientImpactingCount > 0 && (
              <KpiCard label="Patient Impact" value={stats.patientImpactingCount} icon={HeartPulse} iconColor="text-rose-600" alert />
            )}
            {stats.unassignedCount > 0 && (
              <KpiCard label="Unassigned" value={stats.unassignedCount} icon={UserX} iconColor="text-amber-600" />
            )}
            {stats.recurringCount > 0 && (
              <KpiCard label="Recurring" value={stats.recurringCount} icon={RefreshCw} iconColor="text-violet-600" />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                  {Object.entries(TICKET_STATUS_LABELS).map(([status, label]) => (
                    <Link key={status} href={`/tickets?status=${status}`}>
                      <div className="text-center rounded-lg border p-2 hover-elevate cursor-pointer" data-testid={`status-count-${status}`}>
                        <p className="text-lg font-bold tabular-nums">{stats.statusCounts[status] || 0}</p>
                        <StatusBadge type="ticket-status" value={status} size="xs" className="mt-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    By Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(TICKET_PRIORITY_LABELS).map(([priority, label]) => (
                      <div key={priority} className="text-center rounded-lg border p-3" data-testid={`priority-count-${priority}`}>
                        <p className="text-lg font-bold tabular-nums">{stats.priorityCounts[priority] || 0}</p>
                        <StatusBadge type="ticket-priority" value={priority} size="xs" className="mt-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold tabular-nums">{stats.avgTriageHours}h</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Avg. Triage Time</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold tabular-nums">{stats.avgResolutionHours}h</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Avg. Resolution</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Issue Aging
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-emerald-700">{stats.agingBuckets?.under24h ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">&lt; 24 hours</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-sky-700">{stats.agingBuckets?.["1to3days"] ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">1–3 days</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold tabular-nums text-amber-700">{stats.agingBuckets?.["3to7days"] ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">3–7 days</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className={`text-lg font-bold tabular-nums ${(stats.agingBuckets?.over7days ?? 0) > 0 ? "text-rose-700" : ""}`}>{stats.agingBuckets?.over7days ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">&gt; 7 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  By Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {Object.entries(stats.categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, cnt]) => {
                      const maxVal = Math.max(...Object.values(stats.categoryCounts));
                      return (
                        <div key={cat} className="flex items-center justify-between gap-3">
                          <span className="text-sm truncate flex-1">{TICKET_CATEGORY_LABELS[cat] || cat}</span>
                          <div className="flex items-center gap-2 w-28">
                            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min((cnt / maxVal) * 100, 100)}%` }} />
                            </div>
                            <span className="text-sm font-medium tabular-nums w-6 text-right">{cnt}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {!isReadOnly(role) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {canSubmitIssues(role) && (
                      <Link href="/submit">
                        <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-submit">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span className="text-sm">Report Issue</span>
                        </div>
                      </Link>
                    )}
                    <Link href="/supply-requests">
                      <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-supply">
                        <Package className="h-4 w-4 text-amber-600" />
                        <span className="text-sm">Request Supplies</span>
                      </div>
                    </Link>
                    <Link href="/facility-requests">
                      <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-facility">
                        <Wrench className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm">Facilities Request</span>
                      </div>
                    </Link>
                    <Link href="/assets">
                      <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-assets">
                        <Cpu className="h-4 w-4 text-violet-600" />
                        <span className="text-sm">View Equipment</span>
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Operational Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center" data-testid="summary-equipment">
                    <Cpu className="h-4 w-4 text-muted-foreground mx-auto" />
                    <p className="text-xl font-bold tabular-nums mt-1">{stats.equipmentIncidents}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Equipment Issues</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center" data-testid="summary-facility">
                    <Wrench className="h-4 w-4 text-muted-foreground mx-auto" />
                    <p className="text-xl font-bold tabular-nums mt-1">{stats.openFacilityRequests}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Facility Requests</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center" data-testid="summary-supplies">
                    <Package className="h-4 w-4 text-muted-foreground mx-auto" />
                    <p className="text-xl font-bold tabular-nums mt-1">{stats.pendingSupplyRequests}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pending Supplies</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center" data-testid="summary-assets-service">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground mx-auto" />
                    <p className="text-xl font-bold tabular-nums mt-1">{stats.assetsUnderService + (stats.assetsOffline || 0)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Assets Down/Service</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                {stats.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-1">
                    {stats.recentActivity.slice(0, 6).map((item) => (
                      <Link key={item.id} href={`/tickets/${item.id}`}>
                        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/40 cursor-pointer" data-testid={`activity-${item.id}`}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{item.ticketNumber}: {item.title}</p>
                            <p className="text-[10px] text-muted-foreground">{TICKET_CATEGORY_LABELS[item.category] || item.category}</p>
                          </div>
                          <StatusBadge type="ticket-status" value={item.status} size="xs" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {Object.keys(stats.departmentCounts).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Issues by Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.departmentCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([dept, cnt]) => (
                        <div key={dept} className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">{dept}</span>
                          <span className="text-sm font-medium tabular-nums">{cnt}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
