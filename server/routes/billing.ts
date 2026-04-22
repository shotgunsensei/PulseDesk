import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { PLAN_LIMITS } from "@shared/schema";
import { ALLOWED_PLAN_META_KEYS } from "../config/billingConfig";

const router = Router();

function getBaseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const domain = replitDomains.split(",")[0].trim();
    return `https://${domain}`;
  }
  const host = req.get("host") || "localhost:5000";
  const proto = req.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

router.get("/api/billing/plans", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    let rows: any[] = [];
    try {
      const result = await db.execute(sql`
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring->>'interval' as interval
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id
        WHERE p.active = true AND pr.active = true
          AND p.metadata->>'plan' IN ('pro', 'pro_plus', 'enterprise', 'unlimited')
          AND p.name LIKE 'PulseDesk%'
        ORDER BY pr.unit_amount ASC
      `);
      rows = result.rows as any[];
    } catch {
      rows = [];
    }

    if (rows.length === 0) {
      try {
        const stripe = await getUncachableStripeClient();
        const products = await stripe.products.list({ limit: 100, active: true });
        const pulseProducts = products.data.filter(
          (p) => p.name.startsWith("PulseDesk") && ALLOWED_PLAN_META_KEYS.includes(p.metadata?.plan)
        );
        for (const product of pulseProducts) {
          const prices = await stripe.prices.list({ product: product.id, active: true });
          for (const price of prices.data) {
            if (price.recurring?.interval === "month") {
              rows.push({
                product_id: product.id,
                product_name: product.name,
                product_description: product.description,
                product_metadata: product.metadata,
                price_id: price.id,
                unit_amount: price.unit_amount,
                currency: price.currency,
                interval: price.recurring.interval,
              });
            }
          }
        }
        rows.sort((a, b) => (a.unit_amount || 0) - (b.unit_amount || 0));
      } catch {
        rows = [];
      }
    }

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export async function syncOrgPlanFromStripe(orgId: string): Promise<void> {
  const org = await storage.getOrg(orgId);
  if (!org) return;
  const customerId = org.stripeCustomerId;
  if (!customerId) return;

  let subId: string | null = null;
  let subStatus: string | null = null;
  let periodEnd: number | null = null;
  let planMeta: string | null = null;
  let cancelAtPeriodEnd: boolean = false;

  try {
    const subResult = await db.execute(sql`
      SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end, p.metadata as product_metadata
      FROM stripe.subscriptions s
      JOIN stripe.prices pr ON s.items->'data'->0->'price'->>'id' = pr.id
      JOIN stripe.products p ON pr.product = p.id
      WHERE s.customer = ${customerId}
      AND s.status IN ('active', 'trialing')
      ORDER BY s.created DESC
      LIMIT 1
    `);
    if (subResult.rows.length > 0) {
      const row = subResult.rows[0] as any;
      subId = row.id;
      subStatus = row.status;
      periodEnd = row.current_period_end;
      cancelAtPeriodEnd = row.cancel_at_period_end ?? false;
      const meta = typeof row.product_metadata === 'string' ? JSON.parse(row.product_metadata) : row.product_metadata;
      planMeta = meta?.plan;
    }
  } catch {}

  if (!subId) {
    const stripe = await getUncachableStripeClient();
    const allSubs: any[] = [];
    for (const status of ["active", "trialing"] as const) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      allSubs.push(...subs.data);
    }
    allSubs.sort((a, b) => b.created - a.created);
    if (allSubs.length > 0) {
      const sub = allSubs[0];
      subId = sub.id;
      subStatus = sub.status;
      periodEnd = sub.current_period_end;
      cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
      const priceId = sub.items?.data?.[0]?.price?.id;
      if (priceId) {
        const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
        const product = price.product;
        const productMeta = typeof product === "object" && product !== null ? (product as any).metadata : null;
        planMeta = productMeta?.plan;
      }
    }
  }

  if (subId && subStatus && planMeta) {
    const stripePlan = ALLOWED_PLAN_META_KEYS.includes(planMeta) ? planMeta : "pro";
    await storage.updateOrg(orgId, {
      plan: stripePlan as any,
      stripeSubscriptionId: subId,
      planExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      subscriptionStatus: subStatus,
      cancelAtPeriodEnd,
    } as any);
  } else if (!subId) {
    await storage.updateOrg(orgId, {
      plan: "free",
      stripeSubscriptionId: null,
      planExpiresAt: null,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
    } as any);
  }
}

async function getApprovedPriceIds(): Promise<Set<string>> {
  try {
    const result = await db.execute(sql`
      SELECT pr.id
      FROM stripe.prices pr
      JOIN stripe.products p ON pr.product = p.id
      WHERE p.active = true AND pr.active = true
      AND (p.metadata->>'plan' IN ('pro', 'pro_plus', 'enterprise', 'unlimited'))
      AND p.name LIKE 'PulseDesk%'
      AND pr.recurring IS NOT NULL
    `);
    if (result.rows.length > 0) {
      return new Set(result.rows.map((r: any) => r.id));
    }
  } catch {}

  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ limit: 100, active: true });
    const ids = new Set<string>();
    for (const p of products.data) {
      if (!p.name.startsWith("PulseDesk") || !ALLOWED_PLAN_META_KEYS.includes(p.metadata?.plan)) continue;
      const prices = await stripe.prices.list({ product: p.id, active: true, type: "recurring" });
      for (const pr of prices.data) ids.add(pr.id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

router.get("/api/billing/status", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    let stripeSyncStatus = "connected";
    try {
      await syncOrgPlanFromStripe(req.session.orgId!);
    } catch {
      stripeSyncStatus = "unavailable";
    }

    const org = await storage.getOrg(req.session.orgId!);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const counts = await storage.getOrgCounts(req.session.orgId!);
    const plan = org.plan || "free";
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    let subscriptionStatus: string | null = org.subscriptionStatus ?? null;

    if (!subscriptionStatus && org.stripeSubscriptionId) {
      try {
        const subResult = await db.execute(sql`
          SELECT s.status FROM stripe.subscriptions s
          WHERE s.id = ${org.stripeSubscriptionId}
          LIMIT 1
        `);
        subscriptionStatus = subResult.rows.length > 0 ? (subResult.rows[0] as any).status : null;
      } catch {}

      if (!subscriptionStatus) {
        try {
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          subscriptionStatus = sub.status;
        } catch {
          subscriptionStatus = null;
        }
      }
    }

    res.json({
      plan,
      stripeCustomerId: org.stripeCustomerId || null,
      stripeSubscriptionId: org.stripeSubscriptionId || null,
      planExpiresAt: org.planExpiresAt || null,
      subscriptionStatus,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd ?? false,
      stripeSyncStatus,
      limits: {
        maxMembers: limits.maxMembers === Infinity ? null : limits.maxMembers,
        maxTickets: limits.maxTickets === Infinity ? null : limits.maxTickets,
        entraEnabled: limits.entraEnabled,
      },
      usage: {
        members: counts.members,
        tickets: counts.tickets,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/billing/checkout", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "Price ID required" });

    const approved = await getApprovedPriceIds();
    if (!approved.has(priceId)) {
      return res.status(400).json({ error: "Invalid price selection" });
    }

    const org = await storage.getOrg(req.session.orgId!);
    if (!org) return res.status(404).json({ error: "Org not found" });
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });

    const stripe = await getUncachableStripeClient();

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: org.name,
        metadata: { orgId: org.id, orgSlug: org.slug },
      });
      customerId = customer.id;
      await storage.updateOrg(org.id, { stripeCustomerId: customerId } as any);
    }

    const baseUrl = getBaseUrl(req);
    const timeBucket = Math.floor(Date.now() / 3600000);
    const idempotencyKey = `checkout-${org.id}-${priceId}-${timeBucket}`;

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        allow_promotion_codes: true,
        success_url: `${baseUrl}/billing?billing=success`,
        cancel_url: `${baseUrl}/billing?billing=cancelled`,
        metadata: { orgId: org.id },
      },
      { idempotencyKey }
    );

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing checkout error]", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/api/billing/portal", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    const org = await storage.getOrg(req.session.orgId!);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const customerId = org.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: "No billing account linked" });

    const stripe = await getUncachableStripeClient();
    const baseUrl = getBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing portal error]", err);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

router.get("/api/billing/publishable-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err: any) {
    console.error("[billing key error]", err);
    res.status(500).json({ error: "Failed to retrieve billing configuration" });
  }
});

export default router;
