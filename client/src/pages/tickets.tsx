import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { Search, PlusCircle, AlertTriangle, HeartPulse } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { canSubmitIssues } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
  type Ticket,
} from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

type TicketWithNames = Ticket & { departmentName?: string; reportedByName?: string; assignedToName?: string };

export default function TicketsPage() {
  const { membership } = useAuth();
  const role = membership?.role;
  const searchParams = useSearch();
  const urlStatus = new URLSearchParams(searchParams).get("status");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (urlStatus) setStatusFilter(urlStatus);
  }, [urlStatus]);

  const { data: tickets, isLoading } = useQuery<TicketWithNames[]>({
    queryKey: ["/api/tickets"],
  });

  const filtered = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            t.title.toLowerCase().includes(s) ||
            t.ticketNumber.toLowerCase().includes(s) ||
            (t.departmentName || "").toLowerCase().includes(s) ||
            (t.assignedToName || "").toLowerCase().includes(s) ||
            (t.location || "").toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tickets, search, statusFilter, priorityFilter, categoryFilter]);

  const activeFilters = [statusFilter !== "all", priorityFilter !== "all", categoryFilter !== "all", search.length > 0].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Ticket Queue"
        description={`${filtered.length} issue${filtered.length !== 1 ? "s" : ""}${activeFilters > 0 ? ` (filtered)` : ""}`}
        action={
          canSubmitIssues(role) ? (
            <Link href="/submit">
              <Button data-testid="button-new-ticket" size="sm">
                <PlusCircle className="h-4 w-4 mr-1.5" />
                Report Issue
              </Button>
            </Link>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search by title, ticket #, department, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]" data-testid="filter-priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px]" data-testid="filter-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(TICKET_CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setCategoryFilter("all"); setSearch(""); }}
              className="text-xs text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-muted-foreground mb-1">No tickets match your criteria</p>
              <p className="text-xs text-muted-foreground mb-4">Try adjusting your filters or search terms</p>
              {canSubmitIssues(role) && (
                <Link href="/submit">
                  <Button variant="outline" size="sm" data-testid="button-empty-submit">
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Report an Issue
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((ticket) => {
              const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && !["resolved", "closed"].includes(ticket.status);
              return (
                <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                  <div
                    className={`flex items-center gap-4 rounded-lg border bg-card px-4 py-3 hover-elevate cursor-pointer ${isOverdue ? "border-l-2 border-l-rose-400" : ""}`}
                    data-testid={`ticket-row-${ticket.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                        <StatusBadge type="ticket-priority" value={ticket.priority} size="xs" />
                        {ticket.isPatientImpacting && (
                          <span className="text-[10px] font-medium text-rose-700 flex items-center gap-0.5">
                            <HeartPulse className="h-3 w-3" />
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[10px] font-medium text-rose-600 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ticket.departmentName || "No department"}
                        {ticket.location && ` · ${ticket.location}`}
                        {ticket.assignedToName && ` · ${ticket.assignedToName}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge type="ticket-status" value={ticket.status} size="xs" />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
