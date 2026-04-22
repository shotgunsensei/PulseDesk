import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireSuperAdmin } from "../middleware";
import { db } from "../db";
import { users, memberships, orgs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { syncOrgPlanFromStripe } from "./billing";

const router = Router();

const VALID_PLANS = ["free", "pro", "pro_plus", "enterprise", "unlimited"] as const;
const VALID_ROLES = ["owner", "admin", "supervisor", "staff", "technician", "readonly"] as const;

const updatePlanSchema = z.object({
  plan: z.enum(VALID_PLANS),
});

const updateRoleSchema = z.object({
  role: z.enum(VALID_ROLES),
});

router.get("/api/admin/orgs", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allOrgs = await storage.getAllOrgs();
    const orgsWithCounts = await Promise.all(
      allOrgs.map(async (org) => {
        const counts = await storage.getOrgCounts(org.id);
        const mems = await storage.getOrgMemberships(org.id);
        return { ...org, counts, memberCount: mems.length };
      })
    );
    res.json(orgsWithCounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/admin/orgs/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await storage.deleteOrg(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/orgs/:id/plan", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid plan", validPlans: VALID_PLANS });
    }

    const org = await storage.getOrg(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const updated = await storage.updateOrg(req.params.id, { plan: parsed.data.plan as any });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/users", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    const usersWithMemberships = await Promise.all(
      allUsers.map(async (u) => {
        const userMemberships = await db
          .select({
            orgId: memberships.orgId,
            role: memberships.role,
            orgName: orgs.name,
            orgSlug: orgs.slug,
            orgPlan: orgs.plan,
          })
          .from(memberships)
          .innerJoin(orgs, eq(memberships.orgId, orgs.id))
          .where(eq(memberships.userId, u.id));

        return {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          isSuperAdmin: u.isSuperAdmin,
          createdAt: u.createdAt,
          memberships: userMemberships,
        };
      })
    );
    res.json(usersWithMemberships);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/orgs/:orgId/members/:userId/role", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.params;
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid role", validRoles: VALID_ROLES });
    }

    const mem = await storage.getMembership(orgId, userId);
    if (!mem) return res.status(404).json({ error: "Membership not found" });

    await storage.updateMembershipRole(orgId, userId, parsed.data.role);
    res.json({ ok: true, orgId, userId, role: parsed.data.role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/billing", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allOrgs = await storage.getAllOrgs();
    const rows = allOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      stripeCustomerId: org.stripeCustomerId || null,
      stripeSubscriptionId: org.stripeSubscriptionId || null,
      subscriptionStatus: org.subscriptionStatus || null,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd ?? false,
      planExpiresAt: org.planExpiresAt || null,
    }));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/admin/billing/sync/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const org = await storage.getOrg(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    await syncOrgPlanFromStripe(req.params.orgId);
    const updated = await storage.getOrg(req.params.orgId);
    res.json({ ok: true, plan: updated?.plan, subscriptionStatus: updated?.subscriptionStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/users/:id/superadmin", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isSuperAdmin } = req.body;

    if (typeof isSuperAdmin !== "boolean") {
      return res.status(400).json({ error: "isSuperAdmin must be a boolean" });
    }

    if (id === req.session.userId && !isSuperAdmin) {
      return res.status(400).json({ error: "Cannot remove your own super admin status" });
    }

    await db.update(users).set({ isSuperAdmin }).where(eq(users.id, id));
    res.json({ ok: true, userId: id, isSuperAdmin });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
