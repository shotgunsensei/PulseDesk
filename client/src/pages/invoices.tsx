import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Receipt, Search } from "lucide-react";
import { format } from "date-fns";
import type { Invoice } from "@shared/schema";

export default function InvoicesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery<(Invoice & { customerName?: string; total?: number })[]>({
    queryKey: ["/api/invoices"],
  });

  const filtered = invoices.filter(
    (inv) =>
      (inv.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "id",
      header: "Invoice",
      render: (inv: Invoice & { customerName?: string }) => (
        <div>
          <p className="font-medium">#{inv.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{inv.customerName || "No customer"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv: Invoice) => <StatusBadge status={inv.status} type="invoice" />,
    },
    {
      key: "total",
      header: "Total",
      render: (inv: Invoice & { total?: number }) => (
        <span className="font-medium">
          ${(inv.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "due",
      header: "Due Date",
      className: "hidden md:table-cell",
      render: (inv: Invoice) => (
        <span className="text-sm text-muted-foreground">
          {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "-"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden lg:table-cell",
      render: (inv: Invoice) => (
        <span className="text-sm text-muted-foreground">
          {inv.createdAt ? format(new Date(inv.createdAt), "MMM d, yyyy") : ""}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Invoices"
        description="Manage billing and payments"
        actions={
          <Button size="sm" onClick={() => navigate("/invoices/new")} data-testid="button-add-invoice">
            <Plus className="h-4 w-4 mr-1" />
            New Invoice
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-invoices"
            />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
          testIdPrefix="invoice-row"
          emptyState={
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Create your first invoice to start billing customers."
              actionLabel="New Invoice"
              onAction={() => navigate("/invoices/new")}
            />
          }
        />
      </div>
    </div>
  );
}
