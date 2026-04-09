import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, UserCog } from "lucide-react";

interface MemberWithUser {
  userId: string;
  orgId: string;
  role: string;
  user: { id: string; fullName: string; username: string; email?: string } | null;
}

interface InviteCode {
  id: string;
  code: string;
  role: string;
}

export default function SettingsPage() {
  const { user, org, refreshAuth } = useAuth();
  const { toast } = useToast();

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    email: user?.email || "",
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [orgForm, setOrgForm] = useState({
    name: org?.name || "",
    phone: org?.phone || "",
    email: org?.email || "",
    address: org?.address || "",
  });

  const { data: members } = useQuery<MemberWithUser[]>({ queryKey: ["/api/memberships"] });
  const { data: inviteCodes } = useQuery<InviteCode[]>({ queryKey: ["/api/invite-codes"] });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/auth/profile", data),
    onSuccess: () => { refreshAuth(); toast({ title: "Profile updated" }); },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/auth/change-password", data),
    onSuccess: () => { setPasswordForm({ currentPassword: "", newPassword: "" }); toast({ title: "Password changed" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/orgs/${org?.id}`, data),
    onSuccess: () => { refreshAuth(); toast({ title: "Organization updated" }); },
  });

  const createInviteMutation = useMutation({
    mutationFn: (role: string) => apiRequest("POST", "/api/invite-codes", { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invite-codes"] }); toast({ title: "Invite code created" }); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest("PATCH", `/api/memberships/${userId}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }); toast({ title: "Role updated" }); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/memberships/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }); toast({ title: "Member removed" }); },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" description="Manage your profile, organization, and team" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="profile">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Full Name</Label><Input data-testid="input-profile-name" value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} className="mt-1" /></div>
                  <div><Label>Phone</Label><Input data-testid="input-profile-phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="mt-1" /></div>
                  <div><Label>Email</Label><Input data-testid="input-profile-email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="mt-1" /></div>
                  <Button data-testid="button-save-profile" onClick={() => updateProfileMutation.mutate(profileForm)} disabled={updateProfileMutation.isPending}>Save Profile</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Current Password</Label><Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="mt-1" /></div>
                  <div><Label>New Password</Label><Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="mt-1" placeholder="At least 6 characters" /></div>
                  <Button onClick={() => changePasswordMutation.mutate(passwordForm)} disabled={changePasswordMutation.isPending}>Change Password</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organization" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Organization Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Name</Label><Input data-testid="input-org-name" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} className="mt-1" /></div>
                  <div><Label>Phone</Label><Input value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} className="mt-1" /></div>
                  <div><Label>Email</Label><Input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} className="mt-1" /></div>
                  <div><Label>Address</Label><Input value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} className="mt-1" /></div>
                  <Button data-testid="button-save-org" onClick={() => updateOrgMutation.mutate(orgForm)} disabled={updateOrgMutation.isPending}>Save Organization</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><UserCog className="h-4 w-4" /> Team Members</CardTitle>
                  <CardDescription>Manage roles and access for your team</CardDescription>
                </CardHeader>
                <CardContent>
                  {!members || members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members</p>
                  ) : (
                    <div className="space-y-3">
                      {members.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between gap-3 rounded-md border p-3" data-testid={`member-${m.userId}`}>
                          <div>
                            <p className="text-sm font-medium">{m.user?.fullName || m.user?.username || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">@{m.user?.username}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.userId !== user?.id ? (
                              <>
                                <Select value={m.role} onValueChange={(role) => updateRoleMutation.mutate({ userId: m.userId, role })}>
                                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["admin", "supervisor", "staff", "technician", "readonly"].map((r) => (
                                      <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove this member?")) removeMemberMutation.mutate(m.userId); }}>
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">{m.role} (you)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Invite Codes</CardTitle>
                  <CardDescription>Generate invite codes for new team members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createInviteMutation.mutate("staff")} disabled={createInviteMutation.isPending} data-testid="button-create-invite">
                      Generate Staff Invite
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => createInviteMutation.mutate("technician")}>
                      Generate Technician Invite
                    </Button>
                  </div>
                  {inviteCodes && inviteCodes.length > 0 && (
                    <div className="space-y-2">
                      {inviteCodes.map((ic) => (
                        <div key={ic.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                          <code className="text-xs font-mono">{ic.code}</code>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{ic.role}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(ic.code);
                                toast({ title: "Code copied" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
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
    </div>
  );
}
