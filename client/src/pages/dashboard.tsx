import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  TICKET_CATEGORY_LABELS,
} from "@shared/schema";

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
  criticalHighOpen: number;
  recentActivity: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    updatedAt: string;
  }>;
  isEmpty: boolean;
}

function EmptyState() {
  const steps = [
    { label: "Submit your first issue", href: "/submit" },
    { label: "Set up departments", href: "/departments" },
    { label: "Add equipment/assets", href: "/assets" },
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
              <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 shrink-0 border-gray-300" />
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
  const { org } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: !!org,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Dashboard" description="Loading..." />
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
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

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href="/tickets?status=new">
            <div className="rounded-xl border bg-card p-4 hover-elevate cursor-pointer" data-testid="kpi-new-tickets">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Intake</span>
                <Ticket className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{stats.statusCounts.new || 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">awaiting triage</p>
            </div>
          </Link>

          <Link href="/tickets">
            <div className="rounded-xl border bg-card p-4 hover-elevate cursor-pointer" data-testid="kpi-open-tickets">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Open Issues</span>
                <Activity className="h-4 w-4 text-accent" />
              </div>
              <p className="text-2xl font-bold">{stats.openTickets}</p>
              <p className="text-xs text-muted-foreground mt-0.5">in progress</p>
            </div>
          </Link>

          <div className={`rounded-xl border p-4 ${stats.overdueCount > 0 ? "border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20" : "bg-card"}`} data-testid="kpi-overdue">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${stats.overdueCount > 0 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>Overdue</span>
              <AlertTriangle className={`h-4 w-4 ${stats.overdueCount > 0 ? "text-rose-500" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-2xl font-bold ${stats.overdueCount > 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>{stats.overdueCount}</p>
            {stats.overdueCount === 0 && <p className="text-xs text-muted-foreground mt-0.5">all current</p>}
            {stats.overdueCount > 0 && <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">requires attention</p>}
          </div>

          <div className={`rounded-xl border p-4 ${stats.criticalHighOpen > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20" : "bg-card"}`} data-testid="kpi-critical">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Critical / High</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{stats.criticalHighOpen}</p>
            <p className="text-xs text-muted-foreground mt-0.5">unresolved</p>
          </div>

          <div className="rounded-xl border bg-card p-4" data-testid="kpi-resolved">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Resolved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{stats.resolvedThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-0.5">this month</p>
          </div>
        </div>

        {stats.isEmpty && <EmptyState />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  Ticket Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                  {Object.entries(TICKET_STATUS_LABELS).map(([status, label]) => (
                    <Link key={status} href={`/tickets?status=${status}`}>
                      <div className="text-center rounded-lg border p-2 hover-elevate cursor-pointer" data-testid={`status-count-${status}`}>
                        <p className="text-base font-bold">{stats.statusCounts[status] || 0}</p>
                        <div className={`text-[9px] font-medium px-1 py-0.5 rounded mt-1 ${TICKET_STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
                          {label}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Open by Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([priority, label]) => (
                    <div key={priority} className="text-center rounded-lg border p-3" data-testid={`priority-count-${priority}`}>
                      <p className="text-lg font-bold">{stats.priorityCounts[priority] || 0}</p>
                      <div className={`text-xs font-medium px-2 py-0.5 rounded mt-1 inline-block ${TICKET_PRIORITY_COLORS[priority]}`}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Open by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, cnt]) => (
                      <div key={cat} className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{TICKET_CATEGORY_LABELS[cat] || cat}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-muted overflow-hidden w-24">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((cnt / Math.max(...Object.values(stats.categoryCounts))) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-6 text-right">{cnt}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href="/submit">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-submit">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span className="text-sm">Report Issue</span>
                    </div>
                  </Link>
                  <Link href="/supply-requests">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-supply">
                      <Package className="h-4 w-4 text-amber-600" />
                      <span className="text-sm">Request Supplies</span>
                    </div>
                  </Link>
                  <Link href="/facility-requests">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-facility">
                      <Wrench className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm">Facilities Request</span>
                    </div>
                  </Link>
                  <Link href="/assets">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2.5 hover-elevate cursor-pointer" data-testid="qa-assets">
                      <Cpu className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">View Equipment</span>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border p-3" data-testid="summary-equipment">
                    <div className="flex items-center justify-center gap-1">
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold mt-1">{stats.equipmentIncidents}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Equipment Issues</p>
                  </div>
                  <div className="rounded-lg border p-3" data-testid="summary-facility">
                    <div className="flex items-center justify-center gap-1">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold mt-1">{stats.facilityIncidents}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Facility Issues</p>
                  </div>
                  <div className="rounded-lg border p-3" data-testid="summary-supplies">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold mt-1">{stats.pendingSupplyRequests}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pending Supplies</p>
                  </div>
                  <div className="rounded-lg border p-3" data-testid="summary-assets-service">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold mt-1">{stats.assetsUnderService}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Assets in Service</p>
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
                  <p className="text-sm text-muted-foreground text-center py-3">No recent activity</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentActivity.slice(0, 6).map((item) => (
                      <Link key={item.id} href={`/tickets/${item.id}`}>
                        <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer" data-testid={`activity-${item.id}`}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{item.ticketNumber}: {item.title}</p>
                            <p className="text-[10px] text-muted-foreground">{TICKET_CATEGORY_LABELS[item.category] || item.category}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TICKET_STATUS_COLORS[item.status]}`}>
                            {TICKET_STATUS_LABELS[item.status] || item.status}
                          </span>
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
                    By Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.departmentCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([dept, cnt]) => (
                        <div key={dept} className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">{dept}</span>
                          <span className="text-sm font-medium">{cnt}</span>
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
