import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PulseLoader } from "@/components/pulse-line";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_LIMITS } from "@shared/schema";
import {
  CreditCard,
  Zap,
  Crown,
  ExternalLink,
  Check,
  Users,
  Shield,
  Lock,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  PartyPopper,
  Mail,
} from "lucide-react";

interface BillingStatus {
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planExpiresAt: string | null;
  subscriptionStatus: string | null;
  stripeSyncStatus: string;
  limits: { maxMembers: number | null; maxTickets: number | null; entraEnabled: boolean };
  usage: { members: number; tickets: number };
}

interface StripePlan {
  product_id: string;
  product_name: string;
  product_description: string;
  product_metadata: any;
  price_id: string;
  unit_amount: number;
  currency: string;
  interval: string;
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "Up to 5 team members",
    "Unlimited tickets",
    "Department management",
    "Equipment tracking",
    "Local login only",
  ],
  pro: [
    "Up to 50 team members",
    "Unlimited tickets",
    "Microsoft 365 / Entra SSO",
    "Priority support",
    "Vendor management",
    "Analytics dashboard",
  ],
  pro_plus: [
    "Up to 100 team members",
    "Unlimited tickets",
    "Microsoft 365 / Entra SSO",
    "Priority support",
    "Advanced analytics",
    "Custom role mappings",
  ],
  enterprise: [
    "Up to 200 team members",
    "Unlimited tickets",
    "Microsoft 365 / Entra SSO",
    "Email-to-Ticket automation",
    "Dedicated support",
    "Advanced analytics",
    "Custom integrations",
    "SLA management",
  ],
  unlimited: [
    "Unlimited team members",
    "Unlimited tickets",
    "Microsoft 365 / Entra SSO",
    "Email-to-Ticket automation",
    "White-glove support",
    "All features included",
    "Custom integrations",
    "SLA management",
    "API access",
  ],
};

const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string; icon: string; button: string }> = {
  pro: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: "text-blue-600",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  pro_plus: {
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-200 dark:border-indigo-800",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    icon: "text-indigo-600",
    button: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
  enterprise: {
    bg: "bg-violet-50 dark:bg-violet-950/20",
    border: "border-violet-200 dark:border-violet-800",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    icon: "text-violet-600",
    button: "bg-violet-600 hover:bg-violet-700 text-white",
  },
  unlimited: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: "text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
  },
};

function getPlanIcon(plan: string, className = "h-5 w-5") {
  if (plan === "unlimited") return <Crown className={`${className} text-amber-600`} />;
  if (plan === "enterprise") return <Crown className={`${className} text-violet-600`} />;
  if (plan === "pro_plus") return <Zap className={`${className} text-indigo-600`} />;
  if (plan === "pro") return <Zap className={`${className} text-blue-600`} />;
  return <CreditCard className={`${className} text-slate-500`} />;
}

export default function BillingPage() {
  const { membership } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);
  const isAdmin = canManageSettings(membership?.role);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      window.history.replaceState({}, "", "/billing");
    }
    if (params.get("billing") === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No changes were made to your subscription." });
      window.history.replaceState({}, "", "/billing");
    }
  }, [toast]);

  const { data: billing, isLoading: billingLoading, isError: billingError } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<StripePlan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { priceId });
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => toast({ title: "Checkout failed", description: err.message, variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: Error) => toast({ title: "Portal error", description: err.message, variant: "destructive" }),
  });

  if (billingLoading || plansLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Billing" description="Loading billing information..." />
        <div className="flex-1 flex items-center justify-center">
          <PulseLoader />
        </div>
      </div>
    );
  }

  if (billingError) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Billing" description="Manage your subscription" />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-sm font-medium">Unable to load billing information</p>
              <p className="text-xs text-muted-foreground">Please try again later or contact support.</p>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] })} data-testid="button-retry-billing">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentPlan = billing?.plan || "free";
  const planConfig = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
  const isFree = currentPlan === "free";
  const isPaid = !isFree;

  const planOrder = ["pro", "pro_plus", "enterprise", "unlimited"];
  const currentPlanIndex = planOrder.indexOf(currentPlan);

  const groupedPlans: Record<string, StripePlan[]> = {};
  for (const p of plans) {
    const key = p.product_id;
    if (!groupedPlans[key]) groupedPlans[key] = [];
    groupedPlans[key].push(p);
  }

  const sortedGroupedPlans = Object.entries(groupedPlans).sort(([, a], [, b]) => {
    const aMin = Math.min(...a.map(p => p.unit_amount));
    const bMin = Math.min(...b.map(p => p.unit_amount));
    return aMin - bMin;
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Billing & Plans"
        description="Manage your organization's subscription and usage"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {showSuccess && (
          <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center space-y-3" data-testid="billing-success-banner">
            <PartyPopper className="h-10 w-10 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Subscription activated!</h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Your organization has been upgraded. All new features are now available.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowSuccess(false)} data-testid="button-dismiss-success">
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className={`lg:col-span-2 ${isFree ? "border-amber-200 dark:border-amber-800" : "border-emerald-200 dark:border-emerald-800"}`} data-testid="card-current-plan">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isFree ? "bg-slate-100 dark:bg-slate-800" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                    {getPlanIcon(currentPlan, "h-6 w-6")}
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {planConfig.label} Plan
                      {isFree && (
                        <Badge variant="outline" className="text-[10px] font-normal border-amber-300 text-amber-700 dark:text-amber-400" data-testid="badge-free-plan">
                          Free Tier
                        </Badge>
                      )}
                      {isPaid && billing?.subscriptionStatus && (
                        <Badge variant="outline" className={`text-[10px] font-normal ${billing.subscriptionStatus === "active" ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-amber-300 text-amber-700"}`} data-testid="badge-subscription-status">
                          <div className={`h-1.5 w-1.5 rounded-full mr-1 ${billing.subscriptionStatus === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {billing.subscriptionStatus === "active" ? "Active" : billing.subscriptionStatus}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {isFree
                        ? "You're on the free plan with limited features"
                        : `Your subscription is ${billing?.subscriptionStatus || "active"}`}
                    </CardDescription>
                  </div>
                </div>
                {isPaid && isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {portalMutation.isPending ? "Opening..." : "Manage Billing"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPaid && billing?.planExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  Billing cycle renews on {new Date(billing.planExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-4" data-testid="usage-members">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Team Members</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {billing?.usage.members || 0}
                      <span className="text-muted-foreground font-normal"> / {billing?.limits.maxMembers ?? "∞"}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        billing?.limits.maxMembers && (billing?.usage.members || 0) >= billing.limits.maxMembers
                          ? "bg-rose-500"
                          : billing?.limits.maxMembers && (billing?.usage.members || 0) >= billing.limits.maxMembers * 0.8
                            ? "bg-amber-500"
                            : "bg-primary"
                      }`}
                      style={{
                        width: `${billing?.limits.maxMembers
                          ? Math.min(((billing?.usage.members || 0) / billing.limits.maxMembers) * 100, 100)
                          : 5}%`,
                      }}
                    />
                  </div>
                  {billing?.limits.maxMembers && (billing?.usage.members || 0) >= billing.limits.maxMembers && (
                    <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Member limit reached — upgrade to add more
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-4" data-testid="usage-tickets">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Tickets</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {billing?.usage.tickets || 0}
                      <span className="text-muted-foreground font-normal"> / ∞</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: "5%" }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Unlimited on all plans</p>
                </div>
              </div>

              {isFree && !planConfig.entraEnabled && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4" data-testid="entra-locked-banner">
                  <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Microsoft 365 / Entra SSO locked</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Single sign-on with Microsoft 365 requires a Pro plan or higher. Upgrade to let your team sign in with their work accounts.
                    </p>
                  </div>
                </div>
              )}

              {!planConfig.emailToTicket && (
                <div className="flex items-start gap-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4" data-testid="email-to-ticket-locked-banner">
                  <Mail className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-violet-800 dark:text-violet-200">Email-to-Ticket automation locked</p>
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                      Automatically convert inbound emails into tickets with intelligent threading. Available on Enterprise and Unlimited plans.
                    </p>
                  </div>
                </div>
              )}

              {billing?.stripeSyncStatus === "unavailable" && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Billing sync in progress</p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">Plan data may update shortly.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-plan-features">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Your Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {(PLAN_FEATURES[currentPlan] || PLAN_FEATURES.free).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {isFree && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Locked on Free plan:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Microsoft 365 / Entra SSO</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>More than 5 team members</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Email-to-Ticket automation (Enterprise+)</span>
                    </li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isFree && isAdmin && sortedGroupedPlans.length > 0 && (
          <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-6 text-center space-y-2" data-testid="upgrade-cta-banner">
            <Sparkles className="h-8 w-8 text-primary mx-auto" />
            <h3 className="text-lg font-semibold">Ready to grow your facility operations?</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Upgrade to unlock Microsoft 365 SSO, more team members, Email-to-Ticket automation, and advanced features. Plans start at just $60/month.
            </p>
            <div className="flex items-center justify-center gap-1 pt-1">
              <ArrowRight className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Choose a plan below</span>
            </div>
          </div>
        )}

        {isFree && !isAdmin && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5 text-center space-y-2" data-testid="upgrade-admin-notice">
            <Lock className="h-6 w-6 text-amber-600 mx-auto" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Upgrade available</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Ask your organization admin to upgrade to unlock more features and team slots.
            </p>
          </div>
        )}

        {isAdmin && sortedGroupedPlans.length > 0 && (
          <div data-testid="plan-comparison-section">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {isFree ? "Choose Your Plan" : "Available Plans"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {sortedGroupedPlans.map(([productId, prices]) => {
                const product = prices[0];
                const monthly = prices.find(p => p.interval === "month");
                let planMeta: any = {};
                try {
                  planMeta = typeof product.product_metadata === 'string'
                    ? JSON.parse(product.product_metadata)
                    : product.product_metadata || {};
                } catch { planMeta = {}; }
                const planKey = planMeta?.plan || "";
                const planIdx = planOrder.indexOf(planKey);
                const isCurrentPlan = planKey === currentPlan;
                const isDowngrade = planIdx < currentPlanIndex;
                const colors = PLAN_COLORS[planKey] || PLAN_COLORS.pro;
                const features = PLAN_FEATURES[planKey] || [];
                const planLimits = PLAN_LIMITS[planKey as keyof typeof PLAN_LIMITS];
                const isPopular = planKey === "pro";

                return (
                  <Card
                    key={productId}
                    className={`relative overflow-hidden transition-all ${
                      isCurrentPlan
                        ? "border-2 border-primary ring-1 ring-primary/20"
                        : isPopular && isFree
                          ? `border-2 ${colors.border}`
                          : ""
                    }`}
                    data-testid={`plan-card-${planKey}`}
                  >
                    {isPopular && isFree && !isCurrentPlan && (
                      <div className="absolute top-0 right-0">
                        <div className={`${colors.badge} text-[10px] font-semibold px-3 py-1 rounded-bl-lg`}>
                          Most Popular
                        </div>
                      </div>
                    )}
                    {isCurrentPlan && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-bl-lg">
                          Current Plan
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        {getPlanIcon(planKey)}
                        <CardTitle className="text-base">{product.product_name.replace("PulseDesk ", "")}</CardTitle>
                      </div>
                      {monthly && (
                        <div className="mt-2">
                          <span className="text-3xl font-bold">${(monthly.unit_amount / 100).toFixed(0)}</span>
                          <span className="text-sm text-muted-foreground">/month</span>
                        </div>
                      )}
                      <CardDescription className="text-xs mt-1">
                        {product.product_description || `Up to ${planLimits?.maxMembers === Infinity ? "unlimited" : planLimits?.maxMembers} members`}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${colors.icon}`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isCurrentPlan ? (
                        <Button variant="outline" className="w-full" disabled data-testid={`button-current-${planKey}`}>
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Current Plan
                        </Button>
                      ) : monthly ? (
                        <Button
                          className={`w-full ${isDowngrade ? "" : colors.button}`}
                          variant={isDowngrade ? "outline" : "default"}
                          onClick={() => checkoutMutation.mutate(monthly.price_id)}
                          disabled={checkoutMutation.isPending}
                          data-testid={`button-upgrade-${planKey}`}
                        >
                          {checkoutMutation.isPending ? (
                            "Processing..."
                          ) : isDowngrade ? (
                            "Downgrade"
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-1.5" />
                              Upgrade to {product.product_name.replace("PulseDesk ", "")}
                            </>
                          )}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {isAdmin && sortedGroupedPlans.length === 0 && !plansLoading && (
          <Card data-testid="no-plans-available">
            <CardContent className="py-8 text-center space-y-2">
              <Info className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">No upgrade plans available</p>
              <p className="text-xs text-muted-foreground">Billing plans are being configured. Check back soon.</p>
            </CardContent>
          </Card>
        )}

        {isPaid && isAdmin && (
          <Card data-testid="card-billing-management">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Subscription Management
              </CardTitle>
              <CardDescription>Manage payment methods, view invoices, or change your plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-open-portal"
                >
                  <ExternalLink className="h-4 w-4" />
                  {portalMutation.isPending ? "Opening..." : "Open Billing Portal"}
                </Button>
                <Button
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-change-plan"
                >
                  <Zap className="h-4 w-4" />
                  Change Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Payments are securely processed by Stripe. All plans include unlimited tickets.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardUpsellCard() {
  const { membership } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = canManageSettings(membership?.role);

  const { data: billing } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
  });

  if (!billing || billing.plan !== "free") return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5" data-testid="dashboard-upsell-card">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Unlock More with PulseDesk Pro</h4>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                Free Plan
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "Add Microsoft 365 SSO, grow to 50+ team members, and get priority support."
                : "Your organization is on the free plan. Ask an admin to upgrade."}
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => navigate("/billing")}
                data-testid="button-dashboard-upgrade"
              >
                <Zap className="h-3.5 w-3.5" />
                View Plans & Upgrade
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
