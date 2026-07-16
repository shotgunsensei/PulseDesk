import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PulseLoader } from "@/components/pulse-line";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import type { KnowledgeArticle, KnowledgeCategory } from "@shared/schema";

export default function KnowledgePage() {
  const { membership } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "", body: "", categoryId: "", status: "draft", visibility: "internal" });
  const { data: categories = [] } = useQuery<KnowledgeCategory[]>({ queryKey: ["/api/knowledge/categories"] });
  const { data: articles = [], isLoading } = useQuery<KnowledgeArticle[]>({
    queryKey: ["/api/knowledge/articles", { q: search }],
    queryFn: async () => { const res = await fetch(`/api/knowledge/articles?q=${encodeURIComponent(search)}`, { credentials: "include" }); if (!res.ok) throw new Error("Failed to load knowledge base"); return res.json(); },
  });
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category.name])), [categories]);
  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/knowledge/articles", { ...form, categoryId: form.categoryId === "none" ? null : form.categoryId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] }); setOpen(false); setForm({ title: "", summary: "", body: "", categoryId: "", status: "draft", visibility: "internal" }); toast({ title: "Article created" }); },
  });
  return <div className="flex h-full flex-col">
    <PageHeader title="Knowledge Base" description="Reusable service procedures, troubleshooting guidance, and client-safe answers" action={hasRole(membership?.role, "supervisor") ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New article</Button> : undefined} />
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="relative mb-4 max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search titles, summaries, and article content" /></div>
      {isLoading ? <div className="flex justify-center py-16"><PulseLoader /></div> : articles.length === 0 ? <Card><CardContent className="flex flex-col items-center py-16 text-center"><BookOpen className="mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">No articles found</p><p className="mt-1 text-sm text-muted-foreground">Publish the first service procedure or adjust your search.</p></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{articles.map((article) => <Card key={article.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><FileText className="mt-0.5 h-5 w-5 text-primary" /><span className="rounded-full border px-2 py-0.5 text-[10px] capitalize">{article.status}</span></div><p className="mt-3 font-semibold">{article.title}</p><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{article.summary || article.body}</p><p className="mt-4 text-xs text-muted-foreground">{article.categoryId ? categoryMap[article.categoryId] : "Uncategorized"} · {article.visibility}</p></CardContent></Card>)}</div>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New knowledge article</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div><div><Label>Summary</Label><Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div><div><Label>Article body</Label><Textarea rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Markdown-style plain text is supported and sanitized on the server." /></div><div className="grid grid-cols-3 gap-3"><Select value={form.categoryId || "none"} onValueChange={(value) => setForm({ ...form, categoryId: value })}><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="none">Uncategorized</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select><Select value={form.visibility} onValueChange={(value) => setForm({ ...form, visibility: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="client">Client visible</SelectItem></SelectContent></Select></div><Button className="w-full" disabled={!form.title.trim() || !form.body.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create article"}</Button></div></DialogContent></Dialog>
  </div>;
}
