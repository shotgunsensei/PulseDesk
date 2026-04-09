import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { HeartPulse, Shield, Clock, BarChart3, Building2, ArrowLeft } from "lucide-react";
import { SiMicrosoft } from "react-icons/si";
import { PulseLine, PulseDivider } from "@/components/pulse-line";

interface TenantInfo {
  orgId: string;
  orgName: string;
  orgSlug: string;
  authMode: string;
  logoUrl: string | null;
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);
  const [orgSlug, setOrgSlug] = useState("");
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [m365Loading, setM365Loading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const errorMessages: Record<string, string> = {
        invalid_session: "Session expired. Please sign in again.",
        state_mismatch: "Authentication state mismatch. Please try again.",
        org_not_found: "Organization not found.",
        auth_not_configured: "Authentication is not configured for this organization.",
        config_error: "Authentication configuration error. Contact your administrator.",
        auth_failed: "Authentication failed. Please try again.",
        provisioning_failed: "Could not create your account. Contact your administrator.",
        user_not_provisioned: "Your account has not been set up for this organization. Contact your administrator.",
        session_error: "Session error. Please try again.",
        callback_error: "An error occurred during sign-in. Please try again.",
      };
      toast({
        title: "Sign-in issue",
        description: errorMessages[error] || error,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/");
    }
  }, [toast]);

  const handleLookupTenant = async () => {
    if (!orgSlug.trim()) return;
    setTenantLoading(true);
    try {
      const res = await fetch(`/api/auth/tenant/${encodeURIComponent(orgSlug.trim())}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Organization not found", description: data.error || "Check the organization code and try again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setTenant(data);
    } catch {
      toast({ title: "Error", description: "Could not look up organization", variant: "destructive" });
    } finally {
      setTenantLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password, tenant?.orgSlug);
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerForm.username, registerForm.password, registerForm.fullName);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleM365Login = async () => {
    if (!tenant) return;
    setM365Loading(true);
    try {
      const res = await fetch(`/api/auth/m365/login?org=${encodeURIComponent(tenant.orgSlug)}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Microsoft 365 sign-in failed", description: data.error, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      toast({ title: "Error", description: "Could not initiate Microsoft 365 sign-in", variant: "destructive" });
    } finally {
      setM365Loading(false);
    }
  };

  const showM365 = tenant && (tenant.authMode === "m365" || tenant.authMode === "hybrid");
  const showLocal = !tenant || tenant.authMode === "local" || tenant.authMode === "hybrid";
  const m365Only = tenant?.authMode === "m365";

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] bg-primary items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-[hsl(213,65%,22%)]" />

        <div className="absolute bottom-0 left-0 right-0 opacity-[0.06]">
          <PulseLine variant="full" width="100%" height={80} color="white" animate />
        </div>
        <div className="absolute top-[30%] left-0 right-0 opacity-[0.04]">
          <PulseLine variant="minimal" width="100%" height={40} color="white" animate={false} />
        </div>

        <div className="relative max-w-md text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-accent mb-6 shadow-lg shadow-accent/20">
            <HeartPulse className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">PulseDesk</h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent/80 font-medium mb-4">Operations Management</p>
          <p className="text-primary-foreground/60 text-sm leading-relaxed max-w-xs mx-auto">
            The operational heartbeat of your healthcare facility.
            Clarity, control, and responsiveness — when it matters most.
          </p>

          <div className="my-8">
            <PulseDivider className="text-white/30" />
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 border border-white/10 mb-2">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <p className="text-[11px] text-primary-foreground/50 mt-1 font-medium">Role-Based Access</p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 border border-white/10 mb-2">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <p className="text-[11px] text-primary-foreground/50 mt-1 font-medium">Issue Tracking</p>
            </div>
            <div>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 border border-white/10 mb-2">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <p className="text-[11px] text-primary-foreground/50 mt-1 font-medium">Analytics</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden text-center mb-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent shadow-md shadow-accent/20 mb-3">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">PulseDesk</h1>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1 font-medium">Operations Management</p>
          </div>

          {tenant && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-tenant-name">{tenant.orgName}</p>
                <p className="text-[11px] text-muted-foreground">{tenant.orgSlug}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTenant(null)}
                data-testid="button-change-tenant"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Change
              </Button>
            </div>
          )}

          {!tenant ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Organization Sign-In</CardTitle>
                  <CardDescription>Enter your organization code to get started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="org-slug">Organization Code</Label>
                    <Input
                      id="org-slug"
                      data-testid="input-org-slug"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. metro-health"
                      onKeyDown={(e) => e.key === "Enter" && handleLookupTenant()}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Contact your IT administrator if you don't know your code</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleLookupTenant}
                    disabled={tenantLoading || !orgSlug.trim()}
                    data-testid="button-lookup-tenant"
                  >
                    {tenantLoading ? "Looking up..." : "Continue"}
                  </Button>
                </CardContent>
              </Card>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>

              <Tabs defaultValue="login">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="login" data-testid="tab-login">Direct Sign In</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Staff Sign-In</CardTitle>
                      <CardDescription>Sign in without an organization code</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                          <Label htmlFor="login-user">Username</Label>
                          <Input id="login-user" data-testid="input-login-username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="mt-1" autoComplete="username" />
                        </div>
                        <div>
                          <Label htmlFor="login-pass">Password</Label>
                          <Input id="login-pass" data-testid="input-login-password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="mt-1" autoComplete="current-password" />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                          {loading ? "Signing in..." : "Sign In"}
                        </Button>
                      </form>
                      <div className="mt-4 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Demo access:</p>
                        <p>Username: <code className="font-mono text-foreground/70">demo</code> / Password: <code className="font-mono text-foreground/70">demo123</code></p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="register">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">New Account</CardTitle>
                      <CardDescription>Set up your PulseDesk credentials</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                          <Label htmlFor="reg-name">Full Name</Label>
                          <Input id="reg-name" data-testid="input-register-fullname" value={registerForm.fullName} onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })} className="mt-1" autoComplete="name" />
                        </div>
                        <div>
                          <Label htmlFor="reg-user">Username</Label>
                          <Input id="reg-user" data-testid="input-register-username" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} className="mt-1" autoComplete="username" />
                        </div>
                        <div>
                          <Label htmlFor="reg-pass">Password</Label>
                          <Input id="reg-pass" data-testid="input-register-password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="mt-1" placeholder="Minimum 6 characters" autoComplete="new-password" />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading} data-testid="button-register">
                          {loading ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="space-y-4">
              {showM365 && (
                <Card>
                  <CardContent className="pt-6">
                    <Button
                      className="w-full h-11 gap-3"
                      onClick={handleM365Login}
                      disabled={m365Loading}
                      data-testid="button-m365-login"
                    >
                      <SiMicrosoft className="h-4 w-4" />
                      {m365Loading ? "Redirecting to Microsoft..." : "Sign in with Microsoft 365"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      You'll be redirected to your organization's Microsoft login
                    </p>
                  </CardContent>
                </Card>
              )}

              {showM365 && showLocal && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or sign in with credentials</span></div>
                </div>
              )}

              {showLocal && !m365Only && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {tenant.authMode === "hybrid" ? "Local Admin Sign-In" : "Staff Sign-In"}
                    </CardTitle>
                    <CardDescription>
                      {tenant.authMode === "hybrid"
                        ? "For local fallback administrator accounts"
                        : `Access ${tenant.orgName} operations dashboard`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="tenant-login-user">Username</Label>
                        <Input id="tenant-login-user" data-testid="input-login-username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="mt-1" autoComplete="username" />
                      </div>
                      <div>
                        <Label htmlFor="tenant-login-pass">Password</Label>
                        <Input id="tenant-login-pass" data-testid="input-login-password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="mt-1" autoComplete="current-password" />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                        {loading ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {m365Only && (
                <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground text-center">
                  This organization requires Microsoft 365 sign-in. Contact your administrator if you need local access.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
