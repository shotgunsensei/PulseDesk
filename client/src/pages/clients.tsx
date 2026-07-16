import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Mail, MapPin, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PulseLoader } from "@/components/pulse-line";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { canManageTickets } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

type ClientResponse = { items: Client[]; page: number; pageSize: number; total: number };

export default function ClientsPage() {
  const { membership } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", clientCode: "", email: "", phone: "", address: "", notes: "" });
  const queryKey = ["/api/clients", { q: search }];
  const { data, isLoading } = useQuery<ClientResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(search)}&pageSize=100`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
  });
  const clients = useMemo(() => data?.items ?? [], [data]);
  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clients", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setOpen(false);
      setForm({ name: "", clientCode: "", email: "", phone: "", address: "", notes: "" });
      toast({ title: "Client created" });
    },
    onError: (error: Error) => toast({ title: "Client was not created", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Clients" description={`${data?.total ?? 0} organizations in the active OperatorOS tenant`} action={
        canManageTickets(membership?.role) ? <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-client"><Plus className="mr-1.5 h-4 w-4" />Add client</Button> : undefined
      } />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="relative mb-4 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients by name, code, or email" className="pl-9" data-testid="input-client-search" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><PulseLoader /></div> : clients.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center py-16 text-center"><Building2 className="mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">No clients found</p><p className="mt-1 text-sm text-muted-foreground">Create the first client to connect contacts, sites, assets, and tickets.</p></CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <Card className="h-full cursor-pointer transition-colors hover:border-primary/40" data-testid={`client-${client.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{client.name}</p><p className="font-mono text-xs text-muted-foreground">{client.clientCode}</p></div><span className="rounded-full border px-2 py-0.5 text-[10px] capitalize">{client.status}</span></div>
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{client.email || "No email"}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{client.address || "No address"}</p>
                      <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Open client workspace</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-client-name" /></div><div><Label>Client code *</Label><Input value={form.clientCode} onChange={(e) => setForm({ ...form, clientCode: e.target.value.toUpperCase() })} placeholder="ACME" data-testid="input-client-code" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            <Button className="w-full" disabled={!form.name.trim() || !form.clientCode.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create client"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
