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
import { PlusCircle, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SUPPLY_STATUS_LABELS, type SupplyRequest, type Department } from "@shared/schema";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-purple-100 text-purple-800",
  fulfilled: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
};

export default function SupplyRequestsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requestType: "Medical Supplies", itemName: "", quantity: 1, urgency: "normal", departmentId: "", justification: "" });

  const { data: requests, isLoading } = useQuery<(SupplyRequest & { departmentName?: string; requestedByName?: string })[]>({ queryKey: ["/api/supply-requests"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/supply-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supply-requests"] });
      setOpen(false);
      setForm({ requestType: "Medical Supplies", itemName: "", quantity: 1, urgency: "normal", departmentId: "", justification: "" });
      toast({ title: "Supply request submitted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/supply-requests/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supply-requests"] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Supply Requests"
        description="Track medical, office, and cleaning supply requests"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-supply"><PlusCircle className="h-4 w-4 mr-2" /> Request Supplies</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Supply Request</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-4">
                <div>
                  <Label>Supply Type</Label>
                  <Select value={form.requestType} onValueChange={(v) => setForm({ ...form, requestType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Medical Supplies", "Office Supplies", "Cleaning Supplies", "Lab Supplies", "Other"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Item Name *</Label><Input data-testid="input-item-name" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="Item name" className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantity</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className="mt-1" /></div>
                  <div>
                    <Label>Urgency</Label>
                    <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Justification</Label><Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="Why is this needed?" rows={2} className="mt-1" /></div>
                <Button
                  data-testid="button-save-supply"
                  onClick={() => form.itemName.trim() && createMutation.mutate(form)}
                  disabled={!form.itemName.trim() || createMutation.isPending}
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
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Package className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No supply requests yet</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3" data-testid={`supply-${req.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">{req.requestType}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[req.status]}`}>
                      {SUPPLY_STATUS_LABELS[req.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{req.itemName} (x{req.quantity})</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {req.departmentName || "No department"}{req.requestedByName && ` · ${req.requestedByName}`} · {format(new Date(req.createdAt), "MMM d")}
                  </p>
                </div>
                <Select value={req.status} onValueChange={(v) => updateMutation.mutate({ id: req.id, status: v })}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPLY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
