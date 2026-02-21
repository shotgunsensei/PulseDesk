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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  User,
  Calendar,
  FileText,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { JOB_STATUS_LABELS } from "@shared/schema";
import type { Job, Customer, JobEvent } from "@shared/schema";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);

  const { data: job, isLoading } = useQuery<Job & { customerName?: string }>({
    queryKey: ["/api/jobs", id],
  });

  const { data: events = [] } = useQuery<JobEvent[]>({
    queryKey: ["/api/jobs", id, "events"],
    enabled: !!id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/jobs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id, "events"] });
      setShowEdit(false);
      toast({ title: "Job updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      navigate("/jobs");
      toast({ title: "Job deleted" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/jobs/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id, "events"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!job) {
    return <div className="p-6 text-center text-muted-foreground">Job not found</div>;
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      title: fd.get("title"),
      description: fd.get("description") || "",
      customerId: fd.get("customerId") || null,
      scheduledStart: fd.get("scheduledStart") || null,
      scheduledEnd: fd.get("scheduledEnd") || null,
      internalNotes: fd.get("internalNotes") || "",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={job.title}
        description={job.customerName ? `Customer: ${job.customerName}` : undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate("/jobs")} data-testid="button-back-jobs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/quotes/new?jobId=${id}&customerId=${job.customerId || ""}`)} data-testid="button-create-quote">
              <FileText className="h-4 w-4 mr-1" />
              Quote
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/new?jobId=${id}&customerId=${job.customerId || ""}`)} data-testid="button-create-invoice">
              <Receipt className="h-4 w-4 mr-1" />
              Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-job">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Delete this job?")) deleteMutation.mutate(); }}
              data-testid="button-delete-job"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Select value={job.status} onValueChange={(v) => statusMutation.mutate(v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-job-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {job.scheduledStart && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Scheduled</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {format(new Date(job.scheduledStart), "MMM d, yyyy h:mm a")}
                {job.scheduledEnd && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    {format(new Date(job.scheduledEnd), "h:mm a")}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {job.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>
        )}

        {job.internalNotes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.internalNotes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No events yet</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm">{event.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.createdAt ? format(new Date(event.createdAt), "MMM d, yyyy h:mm a") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input name="title" defaultValue={job.title} required data-testid="input-edit-job-title" />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <select
                name="customerId"
                defaultValue={job.customerId || ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={job.description || ""} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  name="scheduledStart"
                  type="datetime-local"
                  defaultValue={job.scheduledStart ? format(new Date(job.scheduledStart), "yyyy-MM-dd'T'HH:mm") : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  name="scheduledEnd"
                  type="datetime-local"
                  defaultValue={job.scheduledEnd ? format(new Date(job.scheduledEnd), "yyyy-MM-dd'T'HH:mm") : ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea name="internalNotes" defaultValue={job.internalNotes || ""} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-job">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
