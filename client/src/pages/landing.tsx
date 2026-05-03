import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, Inbox, BarChart3, Shield, ArrowRight, Building2, Wrench, Package } from "lucide-react";
import pulsedeskLogo from "@assets/pulsedesklogo_1775753913991.png";
import heroImage from "@assets/Modern_healthcare_tech_in_action_1775753913992.png";
import { EcosystemFooter } from "@/components/ecosystem-footer";
import { PulseLine } from "@/components/pulse-line";

const FEATURES = [
  { icon: Ticket, title: "Ticket queue, role-gated", body: "Capture every facilities, supply, and IT request in one place. Roles, departments, SLAs — all multi-tenant by default." },
  { icon: Inbox, title: "Email-to-ticket", body: "Plug in Microsoft 365, Google Workspace, IMAP, or SendGrid Inbound Parse. New emails become tickets, replies thread automatically." },
  { icon: BarChart3, title: "Operational analytics", body: "See throughput by department, asset, and vendor. Catch escalations before they become incidents." },
];

const WORKFLOWS = [
  { icon: Wrench, label: "Facility requests" },
  { icon: Package, label: "Supply requests" },
  { icon: Building2, label: "Vendor contracts" },
  { icon: Shield, label: "HIPAA-conscious" },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = "PulseDesk — Healthcare operations, coordinated.";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Multi-tenant healthcare operations: ticketing, email-to-ticket, supplies, facilities, vendors, analytics — built for clinics and hospitals.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = desc; document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <img src={pulsedeskLogo} alt="PulseDesk" className="h-8 w-8" />
            <span className="font-semibold tracking-tight">PulseDesk</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" data-testid="link-login">
              <Button variant="ghost" size="sm" className="min-h-[44px] sm:min-h-9">Sign in</Button>
            </Link>
            <Link href="/login?signup=1" data-testid="link-signup">
              <Button size="sm" className="gap-1.5 min-h-[44px] sm:min-h-9">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs text-muted-foreground mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live for healthcare ops teams
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
                The operational heartbeat of your facility.
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed">
                PulseDesk gives clinics and hospitals one place to triage every facilities, supply, IT, and vendor request — with email-to-ticket, role gates, and analytics built in.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login?signup=1" data-testid="cta-primary">
                  <Button size="lg" className="gap-2 min-h-[48px]">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login" data-testid="cta-signin">
                  <Button size="lg" variant="outline" className="min-h-[48px]">Sign in</Button>
                </Link>
              </div>
              <PulseLine variant="divider" width="100%" height={6} color="hsl(var(--accent))" animate className="opacity-30 mt-8" />
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border shadow-xl">
                <img src={heroImage} alt="Healthcare operations" className="w-full h-auto" loading="eager" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {WORKFLOWS.map((w) => (
                <div key={w.label} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-background border" data-testid={`workflow-${w.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <w.icon className="h-5 w-5 text-accent" />
                  <span className="text-sm font-medium">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Built for the way clinics actually run</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Three things every operations lead asks for on day one.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="hover-elevate" data-testid={`feature-${f.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t bg-gradient-to-b from-background to-muted/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Ready to coordinate your facility?</h2>
            <p className="text-muted-foreground mb-6">Spin up an organization in under a minute. Free tier covers small teams; paid plans add email-to-ticket and analytics.</p>
            <Link href="/login?signup=1" data-testid="cta-bottom">
              <Button size="lg" className="gap-2 min-h-[48px]">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <EcosystemFooter />
    </div>
  );
}
