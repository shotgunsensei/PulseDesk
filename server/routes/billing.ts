import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { PLAN_LIMITS } from "@shared/schema";

const router = Router();

router.get("/api/billing/plans", requireAuth, requireOrg, async (req: Request, res: Response) => {
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
    res.json(result.rows);
  } catch (err: any) {
    if (err.message?.includes('stripe.products') || err.message?.includes('does not exist')) {
      res.json([]);
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

const ALLOWED_PLAN_METADATA = ["pro", "pro_plus", "enterprise", "unlimited"];

async function syncOrgPlanFromStripe(orgId: string): Promise<void> {
  try {
    const org = await storage.getOrg(orgId);
    if (!org) return;
    const customerId = (org as any).stripeCustomerId;
    if (!customerId) return;

    const subResult = await db.execute(sql`
      SELECT s.id, s.status, s.current_period_end, p.metadata as product_metadata
      FROM stripe.subscriptions s
      JOIN stripe.prices pr ON s.items->'data'->0->'price'->>'id' = pr.id
      JOIN stripe.products p ON pr.product = p.id
      WHERE s.customer = ${customerId}
      AND s.status IN ('active', 'trialing')
      ORDER BY s.created DESC
      LIMIT 1
    `);

    if (subResult.rows.length > 0) {
      const sub = subResult.rows[0] as any;
      const meta = typeof sub.product_metadata === 'string' ? JSON.parse(sub.product_metadata) : sub.product_metadata;
      const rawPlan = meta?.plan;
      const stripePlan = ALLOWED_PLAN_METADATA.includes(rawPlan) ? rawPlan : "pro";
      const currentPlan = (org as any).plan || "free";
      if (stripePlan !== currentPlan || (org as any).stripeSubscriptionId !== sub.id) {
        await storage.updateOrg(orgId, {
          plan: stripePlan,
          stripeSubscriptionId: sub.id,
          planExpiresAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        } as any);
      }
    } else {
      const currentPlan = (org as any).plan || "free";
      if (currentPlan !== "free") {
        await storage.updateOrg(orgId, {
          plan: "free",
          stripeSubscriptionId: null,
          planExpiresAt: null,
        } as any);
      }
    }
  } catch (err) {
    // stripe schema may not be ready yet
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
    `);
    return new Set(result.rows.map((r: any) => r.id));
  } catch {
    return new Set();
  }
}

router.get("/api/billing/status", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await syncOrgPlanFromStripe(req.session.orgId!);

    const org = await storage.getOrg(req.session.orgId!);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const counts = await storage.getOrgCounts(req.session.orgId!);
    const plan = (org as any).plan || "free";
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    res.json({
      plan,
      stripeCustomerId: (org as any).stripeCustomerId || null,
      stripeSubscriptionId: (org as any).stripeSubscriptionId || null,
      planExpiresAt: (org as any).planExpiresAt || null,
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

    let customerId = (org as any).stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: org.name,
        metadata: { orgId: org.id, orgSlug: org.slug },
      });
      customerId = customer.id;
      await storage.updateOrg(org.id, { stripeCustomerId: customerId } as any);
    }

    const baseUrl = `https://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/settings?billing=success`,
      cancel_url: `${baseUrl}/settings?billing=cancelled`,
      metadata: { orgId: org.id },
    });

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

    const customerId = (org as any).stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: "No billing account linked" });

    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${req.get('host')}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings`,
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
