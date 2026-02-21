import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Wrench,
  FileText,
  Receipt,
  DollarSign,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Job, Customer, Invoice } from "@shared/schema";

interface DashboardStats {
  customerCount: number;
  jobCounts: Record<string, number>;
  totalJobs: number;
  activeJobs: number;
  quoteCount: number;
  invoiceCount: number;
  revenue: number;
  outstanding: number;
  recentJobs: (Job & { customerName?: string })[];
  recentInvoices: (Invoice & { customerName?: string })[];
}

export default function Dashboard() {
  const { org } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: !!org,
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        description={org ? `Overview for ${org.name}` : "Welcome to TradeFlow"}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Revenue"
                value={`$${stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="From paid invoices"
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="Outstanding"
                value={`$${stats.outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Unpaid invoices"
                icon={TrendingUp}
                variant="warning"
              />
              <StatCard
                title="Active Jobs"
                value={stats.activeJobs}
                subtitle={`${stats.totalJobs} total jobs`}
                icon={Wrench}
                variant="primary"
              />
              <StatCard
                title="Customers"
                value={stats.customerCount}
                icon={Users}
                variant="default"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recentJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No jobs yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentJobs.map((job) => (
                        <Link key={job.id} href={`/jobs/${job.id}`}>
                          <div
                            className="flex items-center justify-between gap-3 rounded-md border p-3 hover-elevate cursor-pointer"
                            data-testid={`dashboard-job-${job.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.customerName || "No customer"}
                                {job.scheduledStart &&
                                  ` · ${format(new Date(job.scheduledStart), "MMM d")}`}
                              </p>
                            </div>
                            <StatusBadge status={job.status} type="job" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Recent Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recentInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No invoices yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentInvoices.map((inv) => (
                        <Link key={inv.id} href={`/invoices/${inv.id}`}>
                          <div
                            className="flex items-center justify-between gap-3 rounded-md border p-3 hover-elevate cursor-pointer"
                            data-testid={`dashboard-invoice-${inv.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {inv.customerName || "Invoice"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {inv.dueDate
                                  ? `Due ${format(new Date(inv.dueDate), "MMM d, yyyy")}`
                                  : "No due date"}
                              </p>
                            </div>
                            <StatusBadge status={inv.status} type="invoice" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Jobs by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {Object.entries(stats.jobCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="text-center rounded-md border p-3"
                      data-testid={`job-count-${status}`}
                    >
                      <p className="text-lg font-bold">{count}</p>
                      <StatusBadge status={status} type="job" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
