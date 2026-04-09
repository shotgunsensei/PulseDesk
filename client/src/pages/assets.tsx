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
import { useState, useMemo } from "react";
import { PlusCircle, Cpu, Trash2, Search, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { canManageTickets, canManageSettings } from "@/lib/permissions";
import { ASSET_STATUS_LABELS, type Asset, type Department } from "@shared/schema";

export default function AssetsPage() {
  const { toast } = useToast();
  const { membership } = useAuth();
  const role = membership?.role;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ assetTag: "", name: "", assetType: "", location: "", departmentId: "", serviceVendor: "", warrantyNotes: "", maintenanceNotes: "", status: "active" });

  const { data: assets, isLoading } = useQuery<(Asset & { departmentName?: string })[]>({ queryKey: ["/api/assets"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const filtered = useMemo(() => {
    if (!assets) return [];
    return assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return a.name.toLowerCase().includes(s) || a.assetTag.toLowerCase().includes(s) || (a.assetType || "").toLowerCase().includes(s) || (a.departmentName || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [assets, search, statusFilter]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setOpen(false);
      setForm({ assetTag: "", name: "", assetType: "", location: "", departmentId: "", serviceVendor: "", warrantyNotes: "", maintenanceNotes: "", status: "active" });
      toast({ title: "Equipment registered" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Equipment removed" });
    },
  });

  const statusSummary = useMemo(() => {
    if (!assets) return null;
    const counts: Record<string, number> = {};
    for (const a of assets) counts[a.status] = (counts[a.status] || 0) + 1;
    return counts;
  }, [assets]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Equipment Registry"
        description={`${filtered.length} asset${filtered.length !== 1 ? "s" : ""} tracked`}
        action={
          canManageTickets(role) ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-asset" size="sm"><PlusCircle className="h-4 w-4 mr-1.5" /> Register Equipment</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Register Equipment</DialogTitle></DialogHeader>
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
                  <div><Label>Warranty Notes</Label><Textarea value={form.warrantyNotes} onChange={(e) => setForm({ ...form, warrantyNotes: e.target.value })} placeholder="Warranty details..." rows={2} className="mt-1 resize-none" /></div>
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
                  >{createMutation.isPending ? "Registering..." : "Register Equipment"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {statusSummary && Object.keys(statusSummary).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(ASSET_STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${statusFilter === status ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted/40"}`}
              >
                {label}: {statusSummary[status] || 0}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, tag, type, department..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16"><Cpu className="h-8 w-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">{assets && assets.length > 0 ? "No equipment matches your search" : "No equipment registered yet"}</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((asset) => (
              <div key={asset.id} className={`flex items-center gap-4 rounded-lg border bg-card px-4 py-3 ${asset.status === "offline" ? "border-l-2 border-l-rose-400" : asset.status === "under_service" ? "border-l-2 border-l-amber-400" : ""}`} data-testid={`asset-${asset.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{asset.assetTag}</span>
                    <StatusBadge type="asset-status" value={asset.status} size="xs" />
                    {asset.assetType && <span className="text-[10px] text-muted-foreground">{asset.assetType}</span>}
                  </div>
                  <p className="text-sm font-medium truncate">{asset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    {asset.departmentName && <span>{asset.departmentName}</span>}
                    {asset.location && <><span className="mx-0.5">·</span><MapPin className="h-3 w-3 inline" /> {asset.location}</>}
                    {asset.serviceVendor && <><span className="mx-0.5">·</span>{asset.serviceVendor}</>}
                  </p>
                </div>
                {canManageSettings(role) && (
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove this equipment from the registry?")) deleteMutation.mutate(asset.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
