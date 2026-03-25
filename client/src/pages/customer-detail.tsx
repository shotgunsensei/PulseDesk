import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Edit, Phone, Mail, MapPin, Wrench, FileText, Receipt, Trash2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Customer, Job, Quote, Invoice } from "@shared/schema";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers", id],
  });

  const { data: customerJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/customers", id, "jobs"],
    enabled: !!id,
  });

  const { data: customerInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/customers", id, "invoices"],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowEdit(false);
      toast({ title: "Customer updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      navigate("/customers");
      toast({ title: "Customer deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-6 text-center text-muted-foreground">Customer not found</div>;
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
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
        title={customer.name}
        description="Customer details"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/customers")} data-testid="button-back-customers">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-customer">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Delete this customer?")) deleteMutation.mutate(); }}
              data-testid="button-delete-customer"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {customer.phone && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <a href={`tel:${customer.phone}`} className="text-sm font-medium hover:underline">{customer.phone}</a>
              </div>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${customer.email}`} className="text-sm font-medium hover:underline">{customer.email}</a>
              </div>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{customer.address}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap" data-testid="customer-quick-actions">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/jobs?customerId=${id}`)}
            data-testid="quick-action-new-job"
          >
            <Wrench className="h-3.5 w-3.5" />
            New Job
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/quotes/new?customerId=${id}`)}
            data-testid="quick-action-new-quote"
          >
            <FileText className="h-3.5 w-3.5" />
            New Quote
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/invoices/new?customerId=${id}`)}
            data-testid="quick-action-new-invoice"
          >
            <Receipt className="h-3.5 w-3.5" />
            New Invoice
          </Button>
        </div>

        <Tabs defaultValue="jobs">
          <TabsList>
            <TabsTrigger value="jobs" data-testid="tab-customer-jobs">
              Jobs ({customerJobs.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-customer-invoices">
              Invoices ({customerInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-customer-notes">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="mt-4">
            {customerJobs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No jobs for this customer</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate(`/jobs/new?customerId=${id}`)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Job
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {customerJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`customer-job-${job.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.createdAt ? format(new Date(job.createdAt), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                      <StatusBadge status={job.status} type="job" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            {customerInvoices.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No invoices for this customer</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate(`/invoices/new?customerId=${id}`)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Invoice
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {customerInvoices.map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}>
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`customer-invoice-${inv.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Invoice #{inv.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.dueDate ? `Due ${format(new Date(inv.dueDate), "MMM d, yyyy")}` : "No due date"}
                        </p>
                      </div>
                      <StatusBadge status={inv.status} type="invoice" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {customer.notes ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <p>No notes yet</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setShowEdit(true)}
                      data-testid="button-add-notes"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Notes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" defaultValue={customer.name} required data-testid="input-edit-customer-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" defaultValue={customer.phone || ""} data-testid="input-edit-customer-phone" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={customer.email || ""} data-testid="input-edit-customer-email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input name="address" defaultValue={customer.address || ""} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea name="notes" defaultValue={customer.notes || ""} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-customer">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
