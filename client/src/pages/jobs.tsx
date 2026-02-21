import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wrench, Search, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { JOB_STATUS_LABELS } from "@shared/schema";
import type { Job, Customer } from "@shared/schema";

export default function JobsPage() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<(Job & { customerName?: string })[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowCreate(false);
      toast({ title: "Job created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.customerName || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (j: Job & { customerName?: string }) => (
        <div>
          <p className="font-medium">{j.title}</p>
          <p className="text-xs text-muted-foreground">{j.customerName || "No customer"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (j: Job) => <StatusBadge status={j.status} type="job" />,
    },
    {
      key: "scheduled",
      header: "Scheduled",
      className: "hidden md:table-cell",
      render: (j: Job) => (
        <span className="text-sm text-muted-foreground">
          {j.scheduledStart ? format(new Date(j.scheduledStart), "MMM d, h:mm a") : "-"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden lg:table-cell",
      render: (j: Job) => (
        <span className="text-sm text-muted-foreground">
          {j.createdAt ? format(new Date(j.createdAt), "MMM d, yyyy") : ""}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get("title"),
      description: fd.get("description") || "",
      customerId: fd.get("customerId") || null,
      status: "lead",
      scheduledStart: fd.get("scheduledStart") || null,
      scheduledEnd: fd.get("scheduledEnd") || null,
      internalNotes: fd.get("internalNotes") || "",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Jobs"
        description="Track work from lead to paid"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-job">
            <Plus className="h-4 w-4 mr-1" />
            New Job
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-jobs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-job-status-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} job{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          onRowClick={(j) => navigate(`/jobs/${j.id}`)}
          testIdPrefix="job-row"
          emptyState={
            <EmptyState
              icon={Wrench}
              title="No jobs yet"
              description="Create your first job to start tracking work."
              actionLabel="New Job"
              onAction={() => setShowCreate(true)}
            />
          }
        />
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input name="title" required data-testid="input-job-title" placeholder="e.g. Kitchen sink repair" />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <select
                name="customerId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-job-customer"
              >
                <option value="">No customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" data-testid="input-job-description" placeholder="Job details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date/Time</Label>
                <Input name="scheduledStart" type="datetime-local" data-testid="input-job-start" />
              </div>
              <div className="space-y-2">
                <Label>End Date/Time</Label>
                <Input name="scheduledEnd" type="datetime-local" data-testid="input-job-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea name="internalNotes" data-testid="input-job-notes" placeholder="Notes for your team..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-job">
                {createMutation.isPending ? "Creating..." : "Create Job"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
