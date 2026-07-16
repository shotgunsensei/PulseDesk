import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Queue, SlaPolicy, Team } from "@shared/schema";

type Config = { statuses: any[]; priorities: any[]; types: any[]; categories: any[]; queues: Queue[]; teams: Team[]; slaPolicies: SlaPolicy[] };
type Kind = "statuses" | "priorities" | "types" | "categories" | "teams" | "queues" | "sla";

export default function ServiceDeskAdminPage() {
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind | null>(null);
  const [form, setForm] = useState({ name: "", key: "", description: "", responseMinutes: "240", resolutionMinutes: "1440" });
  const { data } = useQuery<Config>({ queryKey: ["/api/service-desk/config"] });
  const create = useMutation({
    mutationFn: () => {
      if (kind === "queues") return apiRequest("POST", "/api/queues", form);
      if (kind === "sla") return apiRequest("POST", "/api/sla-policies", { ...form, responseMinutes: Number(form.responseMinutes), resolutionMinutes: Number(form.resolutionMinutes) });
      return apiRequest("POST", `/api/service-desk/config/${kind}`, form);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-desk/config"] }); setKind(null); setForm({ name: "", key: "", description: "", responseMinutes: "240", resolutionMinutes: "1440" }); toast({ title: "Configuration created" }); },
    onError: (error: Error) => toast({ title: "Configuration was not created", description: error.message, variant: "destructive" }),
  });
  const groups: Array<{ id: Exclude<Kind, "queues" | "sla">; label: string; values: any[] }> = [
    { id: "statuses", label: "Statuses", values: data?.statuses ?? [] }, { id: "priorities", label: "Priorities", values: data?.priorities ?? [] },
    { id: "types", label: "Types", values: data?.types ?? [] }, { id: "categories", label: "Categories", values: data?.categories ?? [] },
    { id: "teams", label: "Teams", values: data?.teams ?? [] },
  ];
  return <div className="flex h-full flex-col"><PageHeader title="Service Desk Administration" description="Tenant-scoped ticket metadata, routing, SLA, roles, and notification controls" />
    <div className="flex-1 overflow-auto p-4 sm:p-6"><Tabs defaultValue="workflow"><TabsList><TabsTrigger value="workflow">Workflow</TabsTrigger><TabsTrigger value="routing">Queues & teams</TabsTrigger><TabsTrigger value="sla">SLA policies</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger></TabsList>
      <TabsContent value="workflow"><div className="grid gap-3 md:grid-cols-2">{groups.slice(0, 4).map((group) => <ConfigCard key={group.id} title={group.label} values={group.values} onAdd={() => setKind(group.id)} />)}</div></TabsContent>
      <TabsContent value="routing"><div className="grid gap-3 md:grid-cols-2"><ConfigCard title="Queues" values={data?.queues ?? []} onAdd={() => setKind("queues")} /><ConfigCard title="Teams" values={data?.teams ?? []} onAdd={() => setKind("teams")} /></div></TabsContent>
      <TabsContent value="sla"><ConfigCard title="SLA policies" values={data?.slaPolicies ?? []} onAdd={() => setKind("sla")} /></TabsContent>
      <TabsContent value="roles"><Card><CardHeader><CardTitle className="text-sm">OperatorOS-backed roles</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Owner / Administrator — configuration and user administration</p><p>Supervisor — assignment, escalation, reporting, and knowledge publishing</p><p>Technician — ticket work, internal notes, time, and assets</p><p>Staff — create tickets and public replies</p><p>Executive — read-only operational visibility</p><p className="pt-2 text-xs text-muted-foreground">Roles are assigned from the OperatorOS tenant and enforced again on every server route.</p></CardContent></Card></TabsContent>
    </Tabs></div>
    <Dialog open={!!kind} onOpenChange={(open) => !open && setKind(null)}><DialogContent><DialogHeader><DialogTitle>Add {kind}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>{kind !== "queues" && kind !== "sla" && kind !== "teams" && <div><Label>Key</Label><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="generated from name if blank" /></div>}<div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>{kind === "sla" && <div className="grid grid-cols-2 gap-3"><div><Label>Response minutes</Label><Input type="number" value={form.responseMinutes} onChange={(e) => setForm({ ...form, responseMinutes: e.target.value })} /></div><div><Label>Resolution minutes</Label><Input type="number" value={form.resolutionMinutes} onChange={(e) => setForm({ ...form, resolutionMinutes: e.target.value })} /></div></div>}<Button className="w-full" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create"}</Button></div></DialogContent></Dialog>
  </div>;
}

function ConfigCard({ title, values, onAdd }: { title: string; values: any[]; onAdd: () => void }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-sm"><Settings2 className="h-4 w-4" />{title}</CardTitle><Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></CardHeader><CardContent className="space-y-2">{values.length === 0 ? <p className="text-sm text-muted-foreground">No configuration yet.</p> : values.map((value) => <div key={value.id} className="flex items-center justify-between rounded-md border px-3 py-2"><div><p className="text-sm font-medium">{value.name}</p><p className="text-xs text-muted-foreground">{value.key || value.description || "Active"}</p></div>{value.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: value.color }} />}</div>)}</CardContent></Card>;
}
