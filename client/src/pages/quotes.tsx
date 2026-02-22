import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import type { Quote, Customer } from "@shared/schema";

export default function QuotesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  const { data: quotes = [], isLoading } = useQuery<(Quote & { customerName?: string; total?: number })[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      (q.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    const matchesCustomer = customerFilter === "all" || q.customerId === customerFilter;
    return matchesSearch && matchesStatus && matchesCustomer;
  });

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
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-quotes"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-quote-status-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-quote-customer-filter">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
