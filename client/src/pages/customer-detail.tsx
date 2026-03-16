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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Edit, Phone, Mail, MapPin, Wrench, FileText, Receipt, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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
    return (
      <div className="p-6 text-center text-muted-foreground">Customer not found</div>
    );
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
              onClick={() => {
                if (confirm("Delete this customer?")) deleteMutation.mutate();
              }}
              data-testid="button-delete-customer"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customer.phone && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{customer.phone}</p>
              </div>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{customer.email}</p>
              </div>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-3 rounded-md border p-4">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{customer.address}</p>
              </div>
            </div>
          )}
        </div>

        {customer.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              Jobs ({customerJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No jobs for this customer</p>
            ) : (
              <div className="space-y-2">
                {customerJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 hover-elevate cursor-pointer">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Invoices ({customerInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No invoices for this customer</p>
            ) : (
              <div className="space-y-2">
                {customerInvoices.map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}>
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 hover-elevate cursor-pointer">
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
          </CardContent>
        </Card>
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
