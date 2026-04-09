import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  counts: {
    tickets: number;
    departments: number;
    assets: number;
    members: number;
  };
}

interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  isSuperAdmin: boolean;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="System Admin" description="Access restricted" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Super admin access required</p>
            <Button variant="outline" className="mt-3" onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const { data: orgs, isLoading: orgsLoading } = useQuery<AdminOrg[]>({ queryKey: ["/api/admin/orgs"] });
  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/orgs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] }); toast({ title: "Organization deleted" }); },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="System Admin" description="Manage all organizations and users" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Organizations ({orgs?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {orgsLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !orgs || orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organizations</p>
            ) : (
              <div className="space-y-2">
                {orgs.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border p-3" data-testid={`admin-org-${o.id}`}>
                    <div>
                      <p className="text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.memberCount} members · {o.counts.tickets} tickets · {o.counts.assets} assets</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${o.name}"?`)) deleteOrgMutation.mutate(o.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Users ({users?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !users || users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-md border p-3" data-testid={`admin-user-${u.id}`}>
                    <div>
                      <p className="text-sm font-medium">{u.fullName} <span className="text-muted-foreground">(@{u.username})</span></p>
                    </div>
                    {u.isSuperAdmin && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">Super Admin</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
