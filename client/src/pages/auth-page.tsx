import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { HeartPulse, Shield, Clock, BarChart3 } from "lucide-react";
import { PulseLine, PulseDivider } from "@/components/pulse-line";

export default function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
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

          <Tabs defaultValue="login">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Staff Sign-In</CardTitle>
                  <CardDescription>Access your facility's operations dashboard</CardDescription>
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
      </div>
    </div>
  );
}
