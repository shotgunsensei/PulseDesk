import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { TICKET_CATEGORY_LABELS } from "@shared/schema";

interface AnalyticsData {
  volumeOverTime: { date: string; count: number }[];
  categoryCounts: Record<string, number>;
  departmentCounts: Record<string, number>;
  recurringCount: number;
  overdueCount: number;
  avgResolutionHours: number;
  vendorRelatedIncidents: number;
  equipmentDowntime: number;
  supplyRequestTrend: { date: string; count: number }[];
  totalTickets: number;
  totalResolved: number;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsData>({ queryKey: ["/api/analytics"] });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Analytics" description="Loading..." />
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const resolutionRate = data.totalTickets > 0 ? Math.round((data.totalResolved / data.totalTickets) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" description="Issue volume, resolution trends, and department performance" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{data.totalTickets}</p>
              <p className="text-xs text-muted-foreground">Total Tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{resolutionRate}%</p>
              <p className="text-xs text-muted-foreground">Resolution Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{data.avgResolutionHours}h</p>
              <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{data.overdueCount}</p>
              <p className="text-xs text-muted-foreground">Overdue Tickets</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ticket Volume (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-[2px] h-32">
                {data.volumeOverTime.map((d, i) => {
                  const maxCount = Math.max(...data.volumeOverTime.map(v => v.count), 1);
                  const height = (d.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.count}`}>
                      <div
                        className="bg-primary rounded-t-sm min-h-[2px] transition-all"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{data.volumeOverTime[0]?.date}</span>
                <span className="text-[10px] text-muted-foreground">{data.volumeOverTime[data.volumeOverTime.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(data.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, cnt]) => {
                    const maxCnt = Math.max(...Object.values(data.categoryCounts));
                    return (
                      <div key={cat} className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate flex-1">{TICKET_CATEGORY_LABELS[cat] || cat}</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(cnt / maxCnt) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium w-6 text-right">{cnt}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Department</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(data.departmentCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, cnt]) => {
                    const maxCnt = Math.max(...Object.values(data.departmentCounts));
                    return (
                      <div key={dept} className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate flex-1">{dept}</span>
                        <div className="flex items-center gap-2 w-32">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(cnt / maxCnt) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium w-6 text-right">{cnt}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Key Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{data.recurringCount}</p>
                  <p className="text-xs text-muted-foreground">Recurring Issues</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{data.vendorRelatedIncidents}</p>
                  <p className="text-xs text-muted-foreground">Vendor Incidents</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{data.equipmentDowntime}</p>
                  <p className="text-xs text-muted-foreground">Equipment Down</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{data.totalResolved}</p>
                  <p className="text-xs text-muted-foreground">Total Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
