import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Search, Phone, Mail, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowCreate(false);
      toast({ title: "Customer created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
  );

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (c: Customer) => (
        <span className="font-medium">{c.name}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden sm:table-cell",
      render: (c: Customer) => (
        <span className="text-muted-foreground text-sm">{c.phone || "-"}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "hidden md:table-cell",
      render: (c: Customer) => (
        <span className="text-muted-foreground text-sm">{c.email || "-"}</span>
      ),
    },
    {
      key: "address",
      header: "Address",
      className: "hidden lg:table-cell",
      render: (c: Customer) => (
        <span className="text-muted-foreground text-sm truncate max-w-[200px] block">
          {c.address || "-"}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: fd.get("name"),
      phone: fd.get("phone") || "",
      email: fd.get("email") || "",
      address: fd.get("address") || "",
      notes: fd.get("notes") || "",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customers"
        description="Manage your customer directory"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-1" />
            Add Customer
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-customers"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          testIdPrefix="customer-row"
          emptyState={
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start tracking jobs and invoices."
              actionLabel="Add Customer"
              onAction={() => setShowCreate(true)}
            />
          }
        />
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cust-name">Name</Label>
              <Input id="cust-name" name="name" required data-testid="input-customer-name" placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input id="cust-phone" name="phone" data-testid="input-customer-phone" placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-email">Email</Label>
                <Input id="cust-email" name="email" type="email" data-testid="input-customer-email" placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-address">Address</Label>
              <Input id="cust-address" name="address" data-testid="input-customer-address" placeholder="123 Main St, City, ST" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-notes">Notes</Label>
              <Textarea id="cust-notes" name="notes" data-testid="input-customer-notes" placeholder="Any notes about this customer..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-customer">
                {createMutation.isPending ? "Creating..." : "Add Customer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
