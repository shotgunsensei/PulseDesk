import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/landing/auth-modal";
import tradeflowLogo from "@assets/tradeflow512_1773073035241.png";
import {
  Zap,
  FileText,
  Users,
  Phone,
  Smartphone,
  BarChart3,
  CheckCircle2,
  Star,
  ArrowRight,
  Wrench,
} from "lucide-react";

const features = [
  {
    icon: Wrench,
    title: "Job Tracking",
    desc: "Track every job from lead to paid. Status workflow keeps your team in sync.",
  },
  {
    icon: FileText,
    title: "Quotes & Invoices",
    desc: "Create professional quotes and invoices in seconds. Send via link, get paid faster.",
  },
  {
    icon: Users,
    title: "Customer History",
    desc: "Full history of every customer — jobs, quotes, invoices, and notes in one place.",
  },
  {
    icon: Zap,
    title: "Team Management",
    desc: "Invite techs, assign jobs, control access. Roles for every team member.",
  },
  {
    icon: Phone,
    title: "Call Recovery AI",
    desc: "Never lose a missed call. AI texts back instantly and books new jobs for you.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First PWA",
    desc: "Works on your phone like a native app. Install from your browser, no app store needed.",
  },
];

const steps = [
  {
    num: "1",
    title: "Capture leads",
    desc: "New customer calls or texts. TradeFlow captures the lead automatically.",
    color: "bg-blue-600",
  },
  {
    num: "2",
    title: "Quote & win jobs",
    desc: "Send a professional quote in 60 seconds. Customers approve on their phone.",
    color: "bg-emerald-600",
  },
  {
    num: "3",
    title: "Get paid",
    desc: "Invoice when the job is done. Track payments. Know exactly what you're owed.",
    color: "bg-amber-600",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    desc: "Get started with the basics",
    features: ["5 customers", "10 jobs", "Quotes & invoices", "1 team member"],
    cta: "Get Started Free",
    tab: "register" as const,
    highlighted: false,
  },
  {
    name: "Individual",
    price: "$20",
    period: "/mo",
    desc: "For solo tradespeople",
    features: ["Unlimited customers", "Unlimited jobs", "Unlimited quotes & invoices", "1 team member"],
    cta: "Start Free Trial",
    tab: "register" as const,
    highlighted: false,
  },
  {
    name: "Small Business",
    price: "$100",
    period: "/mo",
    desc: "For growing crews",
    features: ["Everything in Individual", "Up to 5 team members", "Team workload view", "Priority support"],
    cta: "Start Free Trial",
    tab: "register" as const,
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$200",
    period: "/mo",
    desc: "For large operations",
    features: ["Everything in Small Business", "Unlimited team members", "Dedicated support", "Custom onboarding"],
    cta: "Contact Sales",
    tab: "register" as const,
    highlighted: false,
  },
];

const testimonials = [
  {
    quote: "I used to lose at least 3 jobs a week to missed calls. TradeFlow's call recovery AI texts customers back and books them — I just show up.",
    name: "Mike R.",
    trade: "Electrician · Austin, TX",
    stars: 5,
  },
  {
    quote: "Sending quotes used to take me 30 minutes each. Now it's 2 minutes from the job site. Customers love how professional it looks.",
    name: "Sarah L.",
    trade: "Plumber · Denver, CO",
    stars: 5,
  },
  {
    quote: "Finally a tool built for the trades. No bloat, no learning curve. My whole crew was up and running the same day.",
    name: "Carlos M.",
    trade: "HVAC Contractor · Phoenix, AZ",
    stars: 5,
  },
];

export default function AuthPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "register">("login");

  function openModal(tab: "login" | "register") {
    setModalTab(tab);
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <AuthModal open={modalOpen} defaultTab={modalTab} onClose={() => setModalOpen(false)} />

      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={tradeflowLogo} alt="TradeFlow" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-lg tracking-tight">TradeFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal("login")}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              data-testid="nav-sign-in"
            >
              Sign In
            </button>
            <button
              onClick={() => openModal("register")}
              className="rounded-md bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
              data-testid="nav-get-started"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-800/30 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-800/40 border border-blue-700/50 px-3 py-1 text-xs text-blue-300 mb-6">
              <Zap className="h-3 w-3" />
              Built for electricians, plumbers, HVAC & carpenters
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              Run your trade business{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                from your phone
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              Jobs, quotes, invoices, customers, and team — all in one place. No spreadsheets.
              No chasing payments. No missed leads.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => openModal("register")}
                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-900/40"
                data-testid="hero-get-started"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => openModal("login")}
                className="rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors backdrop-blur"
                data-testid="hero-sign-in"
              >
                Sign In
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Free plan — no credit card
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Set up in under 5 minutes
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Works on any device
              </div>
            </div>
          </div>

          <div className="relative mt-12 md:mt-0 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:w-[480px] lg:w-[560px] pointer-events-none" aria-hidden="true">
            <div className="rounded-xl border border-white/10 bg-slate-800/80 shadow-2xl shadow-black/40 backdrop-blur overflow-hidden mx-4 md:mx-0">
              <div className="bg-slate-900/80 px-4 py-2 flex items-center gap-2 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 mx-4 h-4 rounded bg-slate-700/60 text-[10px] text-slate-400 flex items-center px-2">tradeflow.app/dashboard</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Today's Jobs", val: "3", color: "bg-blue-500/20 text-blue-300" },
                    { label: "Overdue", val: "1", color: "bg-red-500/20 text-red-300" },
                    { label: "Pending Quotes", val: "$4,200", color: "bg-amber-500/20 text-amber-300" },
                    { label: "This Month", val: "$12,840", color: "bg-emerald-500/20 text-emerald-300" },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-lg p-2 ${card.color}`}>
                      <div className="text-[9px] opacity-70 mb-0.5">{card.label}</div>
                      <div className="text-sm font-bold">{card.val}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-slate-700/40 p-3">
                  <div className="text-[10px] text-slate-400 mb-2 font-medium">REVENUE — LAST 30 DAYS</div>
                  <div className="flex items-end gap-1 h-12">
                    {[4, 7, 3, 9, 5, 11, 6, 8, 12, 7, 4, 10, 14, 8, 6, 11, 9, 5, 8, 13, 7, 10, 15, 11, 6, 9, 12, 8, 14, 10].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-blue-500/70" style={{ height: `${(h / 15) * 100}%` }} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-700/40 p-2.5">
                    <div className="text-[10px] text-slate-400 mb-1.5 font-medium">TODAY'S SCHEDULE</div>
                    {["Panel upgrade · 9:00 AM", "Outlet repair · 11:30 AM", "New service · 2:00 PM"].map((job) => (
                      <div key={job} className="text-[10px] text-slate-300 py-1 border-b border-slate-600/40 last:border-0">{job}</div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-slate-700/40 p-2.5">
                    <div className="text-[10px] text-slate-400 mb-1.5 font-medium">PIPELINE</div>
                    {[
                      { s: "Lead", n: 5, c: "bg-gray-400" },
                      { s: "Quoted", n: 3, c: "bg-blue-400" },
                      { s: "Scheduled", n: 3, c: "bg-indigo-400" },
                      { s: "In Progress", n: 2, c: "bg-amber-400" },
                    ].map((row) => (
                      <div key={row.s} className="flex items-center gap-1.5 py-0.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${row.c}`} />
                        <span className="text-[9px] text-slate-300 flex-1">{row.s}</span>
                        <span className="text-[9px] font-bold text-slate-200">{row.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-gray-500">From first contact to final payment — TradeFlow handles it all.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div
                key={step.num}
                className="relative rounded-xl border border-gray-100 bg-gray-50 p-6"
                data-testid={`step-${step.num}`}
              >
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${step.color} text-white font-bold text-base mb-4`}>
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Everything your business needs</h2>
            <p className="text-gray-500">Built for the job site, not the office.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl bg-white border border-gray-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
                  data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 mb-3">
                    <Icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Simple, honest pricing</h2>
            <p className="text-gray-500">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-5 flex flex-col ${
                  plan.highlighted
                    ? "border-blue-600 bg-blue-700 text-white shadow-lg shadow-blue-200"
                    : "border-gray-200 bg-white"
                }`}
                data-testid={`plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="mb-4">
                  <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${plan.highlighted ? "text-blue-200" : "text-gray-400"}`}>
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? "text-blue-200" : "text-gray-400"}`}>{plan.period}</span>
                  </div>
                  <p className={`text-xs mt-1 ${plan.highlighted ? "text-blue-200" : "text-gray-500"}`}>{plan.desc}</p>
                </div>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-xs ${plan.highlighted ? "text-blue-100" : "text-gray-600"}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${plan.highlighted ? "text-blue-200" : "text-emerald-600"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openModal(plan.tab)}
                  className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-white text-blue-700 hover:bg-blue-50"
                      : "bg-blue-700 text-white hover:bg-blue-800"
                  }`}
                  data-testid={`plan-cta-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Trusted by tradespeople</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-xl bg-white border border-gray-100 p-5" data-testid={`testimonial-${i}`}>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.trade}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-800/40 border border-blue-700/50 px-3 py-1 text-xs text-blue-300 mb-5">
            <Smartphone className="h-3 w-3" />
            Works on your phone in the field
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Install TradeFlow on your phone
          </h2>
          <p className="text-slate-300 text-base mb-8 max-w-xl mx-auto">
            Add to your home screen from any browser. No app store, no downloads. Works offline when service is spotty.
          </p>
          <button
            onClick={() => openModal("register")}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-8 py-3.5 text-base font-semibold text-white transition-colors"
            data-testid="mobile-cta"
          >
            Start for Free
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <img src={tradeflowLogo} alt="TradeFlow" className="h-6 w-6 rounded object-contain" />
            <span className="font-medium text-gray-600">TradeFlow</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy Policy
            </Link>
            <span>© {new Date().getFullYear()} TradeFlow. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
