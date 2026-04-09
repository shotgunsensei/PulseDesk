import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PlusCircle, Cpu, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ASSET_STATUS_LABELS, type Asset, type Department } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  under_service: "bg-amber-100 text-amber-800",
  retired: "bg-gray-100 text-gray-800",
  offline: "bg-red-100 text-red-800",
};

export default function AssetsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ assetTag: "", name: "", assetType: "", location: "", departmentId: "", serviceVendor: "", status: "active" });

  const { data: assets, isLoading } = useQuery<(Asset & { departmentName?: string })[]>({ queryKey: ["/api/assets"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setOpen(false);
      setForm({ assetTag: "", name: "", assetType: "", location: "", departmentId: "", serviceVendor: "", status: "active" });
      toast({ title: "Asset added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted" });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Equipment / Assets"
        description="Track medical equipment and facility assets"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-asset"><PlusCircle className="h-4 w-4 mr-2" /> Add Asset</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Asset Tag *</Label><Input data-testid="input-asset-tag" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="MRI-001" className="mt-1" /></div>
                  <div><Label>Type</Label><Input data-testid="input-asset-type" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })} placeholder="MRI Scanner" className="mt-1" /></div>
                </div>
                <div><Label>Name *</Label><Input data-testid="input-asset-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Equipment name" className="mt-1" /></div>
                <div><Label>Location</Label><Input data-testid="input-asset-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Building A, Room 102" className="mt-1" /></div>
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
                <div><Label>Service Vendor</Label><Input value={form.serviceVendor} onChange={(e) => setForm({ ...form, serviceVendor: e.target.value })} placeholder="Vendor name" className="mt-1" /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  data-testid="button-save-asset"
                  onClick={() => form.assetTag.trim() && form.name.trim() && createMutation.mutate(form)}
                  disabled={!form.assetTag.trim() || !form.name.trim() || createMutation.isPending}
                  className="w-full"
                >{createMutation.isPending ? "Adding..." : "Add Asset"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !assets || assets.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Cpu className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No equipment registered yet</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3" data-testid={`asset-${asset.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{asset.assetTag}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[asset.status] || "bg-gray-100 text-gray-800"}`}>
                      {ASSET_STATUS_LABELS[asset.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{asset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {asset.assetType}{asset.departmentName && ` · ${asset.departmentName}`}{asset.location && ` · ${asset.location}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this asset?")) deleteMutation.mutate(asset.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
