import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, Key, Copy, Check } from "lucide-react";
import type { InviteCode } from "@shared/schema";

export default function SettingsPage() {
  const { user, org, refreshAuth } = useAuth();
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: inviteCodes = [] } = useQuery<InviteCode[]>({
    queryKey: ["/api/invite-codes"],
    enabled: !!org,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", "/api/auth/profile", data);
    },
    onSuccess: () => {
      refreshAuth();
      toast({ title: "Profile updated" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/orgs/${org?.id}`, data);
    },
    onSuccess: () => {
      refreshAuth();
      toast({ title: "Organization updated" });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/invite-codes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invite-codes"] });
      toast({ title: "Invite code created" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateProfileMutation.mutate({
      fullName: fd.get("fullName"),
      phone: fd.get("phone") || "",
      email: fd.get("email") || "",
    });
  };

  const handleOrgSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateOrgMutation.mutate({
      name: fd.get("name"),
      phone: fd.get("phone") || "",
      email: fd.get("email") || "",
      address: fd.get("address") || "",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" description="Manage your profile and organization" />

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="profile" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="h-3.5 w-3.5 mr-1.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="org" data-testid="tab-org">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">
              <Key className="h-3.5 w-3.5 mr-1.5" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Profile</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input name="fullName" defaultValue={user?.fullName || ""} data-testid="input-settings-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input name="phone" defaultValue={user?.phone || ""} data-testid="input-settings-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input name="email" type="email" defaultValue={user?.email || ""} data-testid="input-settings-email" />
                    </div>
                  </div>
                  <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="org" className="mt-6">
            {org && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>Manage your business details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleOrgSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Business Name</Label>
                      <Input name="name" defaultValue={org.name} data-testid="input-settings-org-name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input name="phone" defaultValue={org.phone || ""} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input name="email" type="email" defaultValue={org.email || ""} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input name="address" defaultValue={org.address || ""} />
                    </div>
                    <Button type="submit" disabled={updateOrgMutation.isPending} data-testid="button-save-org">
                      {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Invite Codes</CardTitle>
                    <CardDescription>Share codes to invite team members</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      createInviteMutation.mutate({ role: "tech" })
                    }
                    disabled={createInviteMutation.isPending}
                    data-testid="button-create-invite"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {inviteCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No invite codes yet. Create one to invite team members.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inviteCodes.map((ic) => (
                      <div
                        key={ic.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <code className="text-sm font-mono font-medium">{ic.code}</code>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Role: {ic.role}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCode(ic.code)}
                          data-testid={`button-copy-code-${ic.id}`}
                        >
                          {copiedCode === ic.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Plus(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14"/>
      <path d="M12 5v14"/>
    </svg>
  );
}
