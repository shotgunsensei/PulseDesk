import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, Building2, Cpu, MapPin, Plus, Ticket as TicketIcon, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PulseLoader } from "@/components/pulse-line";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ActivityEvent, Asset, Client, Contact, Site, Ticket } from "@shared/schema";

type ClientWorkspace = Client & { sites: Site[]; contacts: Contact[]; tickets: Ticket[]; assets: Asset[]; activity: ActivityEvent[] };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<"site" | "contact" | null>(null);
  const [site, setSite] = useState({ name: "", siteCode: "", address1: "", city: "", state: "", postalCode: "" });
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "" });
  const { data, isLoading } = useQuery<ClientWorkspace>({ queryKey: ["/api/clients", id] });
  const createSite = useMutation({ mutationFn: () => apiRequest("POST", `/api/clients/${id}/sites`, site), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", id] }); setDialog(null); toast({ title: "Site added" }); } });
  const createContact = useMutation({ mutationFn: () => apiRequest("POST", `/api/clients/${id}/contacts`, contact), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clients", id] }); setDialog(null); toast({ title: "Contact added" }); } });
  if (isLoading) return <div className="flex h-full items-center justify-center"><PulseLoader /></div>;
  if (!data) return <div className="p-6"><Link href="/clients"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Clients</Button></Link><p className="mt-6">Client not found.</p></div>;

  return <div className="flex h-full flex-col">
    <PageHeader title={data.name} description={`${data.clientCode} · ${data.status}`} actions={<><Link href="/clients"><Button variant="outline" size="sm"><ArrowLeft className="mr-1.5 h-4 w-4" />Clients</Button></Link><Link href={`/submit?clientId=${data.id}`}><Button size="sm"><TicketIcon className="mr-1.5 h-4 w-4" />New ticket</Button></Link></>} />
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Contact</p><p className="mt-1 text-sm">{data.email || "No email"}</p><p className="text-sm">{data.phone || "No phone"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Service footprint</p><p className="mt-1 text-2xl font-semibold">{data.sites.length} <span className="text-sm font-normal text-muted-foreground">sites</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open work</p><p className="mt-1 text-2xl font-semibold">{data.tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length} <span className="text-sm font-normal text-muted-foreground">tickets</span></p></CardContent></Card>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="sites">Sites ({data.sites.length})</TabsTrigger><TabsTrigger value="contacts">Contacts ({data.contacts.length})</TabsTrigger><TabsTrigger value="tickets">Tickets ({data.tickets.length})</TabsTrigger><TabsTrigger value="assets">Assets ({data.assets.length})</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
        <TabsContent value="overview"><Card><CardHeader><CardTitle className="text-sm">Client notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{data.notes || "No client notes."}</p><p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{data.address || "No primary address"}</p></CardContent></Card></TabsContent>
        <TabsContent value="sites"><Section title="Sites" onAdd={() => setDialog("site")} icon={Building2}>{data.sites.map((item) => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.siteCode} · {[item.address1, item.city, item.state].filter(Boolean).join(", ") || "No address"}</p></div>)}</Section></TabsContent>
        <TabsContent value="contacts"><Section title="Contacts" onAdd={() => setDialog("contact")} icon={UserRound}>{data.contacts.map((item) => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">{item.firstName} {item.lastName}</p><p className="text-xs text-muted-foreground">{[item.title, item.email, item.phone].filter(Boolean).join(" · ")}</p></div>)}</Section></TabsContent>
        <TabsContent value="tickets"><Section title="Tickets" icon={TicketIcon}>{data.tickets.map((ticket) => <Link key={ticket.id} href={`/tickets/${ticket.id}`}><div className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/40"><div><p className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</p><p className="text-sm font-medium">{ticket.title}</p></div><StatusBadge type="ticket-status" value={ticket.status} size="xs" /></div></Link>)}</Section></TabsContent>
        <TabsContent value="assets"><Section title="Assets" icon={Cpu}>{data.assets.map((asset) => <div key={asset.id} className="rounded-lg border p-3"><p className="font-medium">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.assetTag} · {asset.serialNumber || "No serial"}</p></div>)}</Section></TabsContent>
        <TabsContent value="activity"><Section title="Activity" icon={Building2}>{data.activity.map((event) => <div key={event.id} className="border-b py-3 last:border-0"><p className="text-sm">{event.summary || event.action}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></div>)}</Section></TabsContent>
      </Tabs>
    </div>
    <Dialog open={dialog === "site"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Add site</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>Name</Label><Input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} /></div><div><Label>Site code</Label><Input value={site.siteCode} onChange={(e) => setSite({ ...site, siteCode: e.target.value.toUpperCase() })} /></div></div><div><Label>Address</Label><Input value={site.address1} onChange={(e) => setSite({ ...site, address1: e.target.value })} /></div><div className="grid grid-cols-3 gap-2"><Input placeholder="City" value={site.city} onChange={(e) => setSite({ ...site, city: e.target.value })} /><Input placeholder="State" value={site.state} onChange={(e) => setSite({ ...site, state: e.target.value })} /><Input placeholder="ZIP" value={site.postalCode} onChange={(e) => setSite({ ...site, postalCode: e.target.value })} /></div><Button className="w-full" disabled={!site.name || !site.siteCode || createSite.isPending} onClick={() => createSite.mutate()}>Add site</Button></div></DialogContent></Dialog>
    <Dialog open={dialog === "contact"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>First name</Label><Input value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} /></div><div><Label>Last name</Label><Input value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} /></div></div><Input placeholder="Title" value={contact.title} onChange={(e) => setContact({ ...contact, title: e.target.value })} /><Input type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /><Input placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /><Button className="w-full" disabled={!contact.firstName || createContact.isPending} onClick={() => createContact.mutate()}>Add contact</Button></div></DialogContent></Dialog>
  </div>;
}

function Section({ title, onAdd, icon: Icon, children }: { title: string; onAdd?: () => void; icon: any; children: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" />{title}</CardTitle>{onAdd && <Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>}</CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>;
}
