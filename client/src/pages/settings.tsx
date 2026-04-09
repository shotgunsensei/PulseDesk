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
import { Copy, Trash2, UserCog, Clock, Building2, Shield, Bell } from "lucide-react";
import { ROLE_LABELS, canManageSettings } from "@/lib/permissions";

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
  const { user, org, membership, refreshAuth } = useAuth();
  const { toast } = useToast();
  const isAdmin = canManageSettings(membership?.role);

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
  const { data: inviteCodes } = useQuery<InviteCode[]>({
    queryKey: ["/api/invite-codes"],
    enabled: isAdmin,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/auth/profile", data),
    onSuccess: () => { refreshAuth(); toast({ title: "Profile updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/auth/change-password", data),
    onSuccess: () => { setPasswordForm({ currentPassword: "", newPassword: "" }); toast({ title: "Password changed" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/orgs/${org?.id}`, data),
    onSuccess: () => { refreshAuth(); toast({ title: "Organization updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createInviteMutation = useMutation({
    mutationFn: (role: string) => apiRequest("POST", "/api/invite-codes", { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invite-codes"] }); toast({ title: "Invite code created" }); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest("PATCH", `/api/memberships/${userId}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }); toast({ title: "Role updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/memberships/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }); toast({ title: "Member removed" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleProfileSave = () => {
    if (!profileForm.fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordChange = () => {
    if (!passwordForm.currentPassword) {
      toast({ title: "Current password is required", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate(passwordForm);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" description="Manage your profile, organization, and team" />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="profile">
            <TabsList className={`w-full grid ${isAdmin ? "grid-cols-4" : "grid-cols-2"}`}>
              <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
              {isAdmin && <TabsTrigger value="organization" data-testid="tab-organization">Organization</TabsTrigger>}
              {isAdmin && <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>}
              <TabsTrigger value="preferences" data-testid="tab-preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
                  <CardDescription>Update your account details visible to your team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="profile-name">Full Name *</Label>
                    <Input id="profile-name" data-testid="input-profile-name" value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input id="profile-phone" data-testid="input-profile-phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="mt-1" placeholder="Extension or direct line" />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" data-testid="input-profile-email" type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="mt-1" placeholder="your.name@facility.org" />
                  </div>
                  <Button data-testid="button-save-profile" onClick={handleProfileSave} disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security
                  </CardTitle>
                  <CardDescription>Keep your account secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Current Password *</Label>
                    <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="mt-1" autoComplete="current-password" />
                  </div>
                  <div>
                    <Label>New Password *</Label>
                    <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="mt-1" placeholder="At least 6 characters" autoComplete="new-password" />
                    <p className="text-[11px] text-muted-foreground mt-1">Minimum 6 characters required</p>
                  </div>
                  <Button onClick={handlePasswordChange} disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="organization" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Facility Information
                    </CardTitle>
                    <CardDescription>Organization details visible across PulseDesk</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="org-name">Organization Name *</Label>
                      <Input id="org-name" data-testid="input-org-name" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Main Phone</Label>
                        <Input value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} className="mt-1" placeholder="(555) 000-0000" />
                      </div>
                      <div>
                        <Label>Contact Email</Label>
                        <Input value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} className="mt-1" placeholder="ops@facility.org" />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} className="mt-1" placeholder="123 Medical Center Drive" />
                    </div>
                    <Button data-testid="button-save-org" onClick={() => updateOrgMutation.mutate(orgForm)} disabled={updateOrgMutation.isPending}>
                      {updateOrgMutation.isPending ? "Saving..." : "Save Organization"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Operational Settings
                    </CardTitle>
                    <CardDescription>Configure operational parameters for your facility</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Timezone</Label>
                        <Select defaultValue="america_new_york">
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="america_new_york">Eastern (ET)</SelectItem>
                            <SelectItem value="america_chicago">Central (CT)</SelectItem>
                            <SelectItem value="america_denver">Mountain (MT)</SelectItem>
                            <SelectItem value="america_los_angeles">Pacific (PT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Business Hours</Label>
                        <Select defaultValue="24_7">
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24_7">24/7 Operations</SelectItem>
                            <SelectItem value="standard">Standard (8AM - 6PM)</SelectItem>
                            <SelectItem value="extended">Extended (6AM - 10PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 border p-3">
                      <p className="text-xs text-muted-foreground">
                        SLA and escalation rule configuration coming in a future update.
                        Contact your PulseDesk administrator for custom operational parameters.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="team" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2"><UserCog className="h-4 w-4" /> Team Members</CardTitle>
                    <CardDescription>Manage roles and access for your team ({members?.length || 0} members)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!members || members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No team members yet. Generate invite codes below to add your team.</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((m) => (
                          <div key={m.userId} className="flex items-center justify-between gap-3 rounded-lg border p-3" data-testid={`member-${m.userId}`}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{m.user?.fullName || m.user?.username || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">@{m.user?.username}{m.user?.email ? ` · ${m.user.email}` : ""}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.userId !== user?.id ? (
                                <>
                                  <Select value={m.role} onValueChange={(role) => updateRoleMutation.mutate({ userId: m.userId, role })}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(ROLE_LABELS).map(([r, label]) => (
                                        <SelectItem key={r} value={r}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (confirm("Remove this member from the organization?")) removeMemberMutation.mutate(m.userId); }} data-testid={`button-remove-${m.userId}`}>
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">{ROLE_LABELS[m.role] || m.role} (you)</span>
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
                    <CardDescription>Share codes with new team members to join your organization</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => createInviteMutation.mutate("staff")} disabled={createInviteMutation.isPending} data-testid="button-create-invite">
                        Staff Invite
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => createInviteMutation.mutate("technician")}>
                        Technician Invite
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => createInviteMutation.mutate("supervisor")}>
                        Supervisor Invite
                      </Button>
                    </div>
                    {inviteCodes && inviteCodes.length > 0 && (
                      <div className="space-y-2">
                        {inviteCodes.map((ic) => (
                          <div key={ic.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                            <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{ic.code}</code>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground font-medium">{ROLE_LABELS[ic.role] || ic.role}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(ic.code);
                                  toast({ title: "Code copied to clipboard" });
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
            )}

            <TabsContent value="preferences" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Configure how you receive updates about operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/50 border p-4 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Notification preferences</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Email and in-app notification settings will be available in a future update.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-mono text-xs">@{user?.username}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <span className="text-xs font-medium">{ROLE_LABELS[membership?.role || ""] || membership?.role}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span className="text-xs">{org?.name}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
