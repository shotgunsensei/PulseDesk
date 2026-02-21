import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, UserPlus, Wrench, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OrgSetup() {
  const { refreshAuth, user, logout } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreateOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiRequest("POST", "/api/orgs", {
        name: fd.get("name"),
        slug: (fd.get("name") as string).toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
        phone: fd.get("phone") || "",
        email: fd.get("email") || "",
        address: fd.get("address") || "",
      });
      toast({ title: "Organization created!" });
      await refreshAuth();
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiRequest("POST", "/api/orgs/join", {
        code: fd.get("code"),
      });
      toast({ title: "Joined organization!" });
      await refreshAuth();
    } catch (err: any) {
      setError(err.message || "Invalid invite code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">TradeFlow</h1>
            <p className="text-xs text-muted-foreground">Welcome, {user?.fullName || user?.username}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6 ml-[52px]">
          Set up or join an organization to get started.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create a new business or join an existing one with an invite code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Tabs defaultValue="create">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="create" className="flex-1 gap-1.5" data-testid="tab-create-org">
                  <Building2 className="h-3.5 w-3.5" />
                  Create Business
                </TabsTrigger>
                <TabsTrigger value="join" className="flex-1 gap-1.5" data-testid="tab-join-org">
                  <UserPlus className="h-3.5 w-3.5" />
                  Join with Code
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Business Name</Label>
                    <Input
                      id="org-name"
                      name="name"
                      required
                      data-testid="input-org-name"
                      placeholder="e.g. Smith Plumbing LLC"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="org-phone">Phone</Label>
                      <Input
                        id="org-phone"
                        name="phone"
                        data-testid="input-org-phone"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-email">Email</Label>
                      <Input
                        id="org-email"
                        name="email"
                        type="email"
                        data-testid="input-org-email"
                        placeholder="office@company.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-address">Address</Label>
                    <Input
                      id="org-address"
                      name="address"
                      data-testid="input-org-address"
                      placeholder="123 Main St, City, ST 12345"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    data-testid="button-create-org"
                  >
                    {isSubmitting ? "Creating..." : "Create Business"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoinOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Invite Code</Label>
                    <Input
                      id="invite-code"
                      name="code"
                      required
                      data-testid="input-invite-code"
                      placeholder="Enter your invite code"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    data-testid="button-join-org"
                  >
                    {isSubmitting ? "Joining..." : "Join Business"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={logout} data-testid="button-logout-setup">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
