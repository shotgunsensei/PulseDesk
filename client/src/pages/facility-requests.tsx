import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PlusCircle, Wrench } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FACILITY_STATUS_LABELS, FACILITY_TYPE_LABELS, type FacilityRequest } from "@shared/schema";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

export default function FacilityRequestsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requestType: "other", title: "", description: "", location: "", building: "", floor: "", priority: "normal" });

  const { data: requests, isLoading } = useQuery<(FacilityRequest & { assignedToName?: string })[]>({ queryKey: ["/api/facility-requests"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/facility-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facility-requests"] });
      setOpen(false);
      setForm({ requestType: "general", title: "", description: "", location: "", building: "", floor: "", priority: "normal" });
      toast({ title: "Facility request submitted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/facility-requests/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facility-requests"] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Facilities Requests"
        description="HVAC, plumbing, electrical, and general maintenance"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-facility"><PlusCircle className="h-4 w-4 mr-2" /> New Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Facility Request</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.requestType} onValueChange={(v) => setForm({ ...form, requestType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Title *</Label><Input data-testid="input-facility-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief title" className="mt-1" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details..." rows={3} className="mt-1" /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Building A, Floor 2" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Building</Label><Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="A" className="mt-1" /></div>
                  <div><Label>Floor</Label><Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="2" className="mt-1" /></div>
                </div>
                <Button
                  data-testid="button-save-facility"
                  onClick={() => form.title.trim() && createMutation.mutate(form)}
                  disabled={!form.title.trim() || createMutation.isPending}
                  className="w-full"
                >{createMutation.isPending ? "Submitting..." : "Submit Request"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Wrench className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No facility requests yet</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3" data-testid={`facility-${req.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">{FACILITY_TYPE_LABELS[req.requestType]}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[req.priority]}`}>{req.priority}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[req.status]}`}>
                      {FACILITY_STATUS_LABELS[req.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{req.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {req.location || "No location"}{req.assignedToName && ` · ${req.assignedToName}`} · {format(new Date(req.createdAt), "MMM d")}
                  </p>
                </div>
                <Select value={req.status} onValueChange={(v) => updateMutation.mutate({ id: req.id, status: v })}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FACILITY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
