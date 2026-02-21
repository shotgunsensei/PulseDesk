import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import type { Quote } from "@shared/schema";

export default function QuotesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: quotes = [], isLoading } = useQuery<(Quote & { customerName?: string; total?: number })[]>({
    queryKey: ["/api/quotes"],
  });

  const filtered = quotes.filter(
    (q) =>
      (q.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "id",
      header: "Quote",
      render: (q: Quote & { customerName?: string }) => (
        <div>
          <p className="font-medium">#{q.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{q.customerName || "No customer"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (q: Quote) => <StatusBadge status={q.status} type="quote" />,
    },
    {
      key: "total",
      header: "Total",
      render: (q: Quote & { total?: number }) => (
        <span className="font-medium">
          ${(q.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden md:table-cell",
      render: (q: Quote) => (
        <span className="text-sm text-muted-foreground">
          {q.createdAt ? format(new Date(q.createdAt), "MMM d, yyyy") : ""}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Quotes"
        description="Manage estimates and proposals"
        actions={
          <Button size="sm" onClick={() => navigate("/quotes/new")} data-testid="button-add-quote">
            <Plus className="h-4 w-4 mr-1" />
            New Quote
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-quotes"
            />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} quote{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          onRowClick={(q) => navigate(`/quotes/${q.id}`)}
          testIdPrefix="quote-row"
          emptyState={
            <EmptyState
              icon={FileText}
              title="No quotes yet"
              description="Create your first quote to send estimates to customers."
              actionLabel="New Quote"
              onAction={() => navigate("/quotes/new")}
            />
          }
        />
      </div>
    </div>
  );
}
