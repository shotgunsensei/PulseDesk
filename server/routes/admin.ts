import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireSuperAdmin } from "../middleware";
import { db } from "../db";
import { users, memberships, orgs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { syncOrgPlanFromStripe } from "./billing";
import { logAdminAction } from "../lib/adminAudit";

const router = Router();

const VALID_PLANS = ["free", "pro", "pro_plus", "enterprise", "unlimited"] as const;
const VALID_ROLES = ["owner", "admin", "supervisor", "staff", "technician", "readonly"] as const;

const updatePlanSchema = z.object({
  plan: z.enum(VALID_PLANS),
});

const purgeAuditSchema = z.object({
  days: z.number().int().min(7).max(3650),
});

router.post("/api/admin/audit/purge", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = purgeAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      await logAdminAction(req, {
        eventType: "admin_audit_log_purged",
        orgId: req.session.orgId ?? null,
        success: false,
        details: { reason: "invalid_input", body: req.body },
      });
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const deleted = await storage.purgeAuthAuditLogsOlderThan(parsed.data.days);
    await logAdminAction(req, {
      eventType: "admin_audit_log_purged",
      orgId: req.session.orgId ?? null,
      success: true,
      details: { days: parsed.data.days, deletedCount: deleted, scope: "global" },
    });
    res.json({ deleted, days: parsed.data.days });
  } catch (err: any) {
    await logAdminAction(req, {
      eventType: "admin_audit_log_purged",
      orgId: req.session.orgId ?? null,
      success: false,
      details: { error: err?.message ?? "unknown" },
    });
    res.status(500).json({ error: err.message });
  }
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
    const existing = await storage.getOrg(req.params.id);
    if (!existing) {
      await logAdminAction(req, {
        eventType: "admin_org_deleted",
        orgId: req.params.id,
        success: false,
        details: { reason: "not_found" },
      });
      return res.status(404).json({ error: "Organization not found" });
    }
    await storage.deleteOrg(req.params.id);
    await logAdminAction(req, {
      eventType: "admin_org_deleted",
      orgId: null,
      success: true,
      details: {
        deletedOrgId: existing.id,
        before: { name: existing.name, slug: existing.slug, plan: existing.plan },
      },
    });
    res.json({ ok: true });
  } catch (err: any) {
    await logAdminAction(req, {
      eventType: "admin_org_deleted",
      orgId: req.params.id,
      success: false,
      details: { error: err?.message ?? "unknown" },
    });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/orgs/:id/plan", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      await logAdminAction(req, {
        eventType: "admin_org_plan_changed",
        orgId: req.params.id,
        success: false,
        details: { reason: "invalid_plan", body: req.body },
      });
      return res.status(400).json({ error: "Invalid plan", validPlans: VALID_PLANS });
    }

    const org = await storage.getOrg(req.params.id);
    if (!org) {
      await logAdminAction(req, {
        eventType: "admin_org_plan_changed",
        orgId: req.params.id,
        success: false,
        details: { reason: "not_found", requestedPlan: parsed.data.plan },
      });
      return res.status(404).json({ error: "Organization not found" });
    }

    const updated = await storage.updateOrg(req.params.id, { plan: parsed.data.plan as any });
    await logAdminAction(req, {
      eventType: "admin_org_plan_changed",
      orgId: req.params.id,
      success: true,
      details: {
        before: { plan: org.plan },
        after: { plan: parsed.data.plan },
      },
    });
    res.json(updated);
  } catch (err: any) {
    await logAdminAction(req, {
      eventType: "admin_org_plan_changed",
      orgId: req.params.id,
      success: false,
      details: { error: err?.message ?? "unknown" },
    });
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
          createdAt: (u as any).createdAt ?? null,
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
      await logAdminAction(req, {
        eventType: "admin_membership_role_changed",
        orgId,
        targetUserId: userId,
        success: false,
        details: { reason: "invalid_role", body: req.body },
      });
      return res.status(400).json({ error: "Invalid role", validRoles: VALID_ROLES });
    }

    const mem = await storage.getMembership(orgId, userId);
    if (!mem) {
      await logAdminAction(req, {
        eventType: "admin_membership_role_changed",
        orgId,
        targetUserId: userId,
        success: false,
        details: { reason: "not_found", requestedRole: parsed.data.role },
      });
      return res.status(404).json({ error: "Membership not found" });
    }

    await storage.updateMembershipRole(orgId, userId, parsed.data.role);
    await logAdminAction(req, {
      eventType: "admin_membership_role_changed",
      orgId,
      targetUserId: userId,
      success: true,
      details: {
        before: { role: mem.role },
        after: { role: parsed.data.role },
      },
    });
    res.json({ ok: true, orgId, userId, role: parsed.data.role });
  } catch (err: any) {
    await logAdminAction(req, {
      eventType: "admin_membership_role_changed",
      orgId: req.params.orgId,
      targetUserId: req.params.userId,
      success: false,
      details: { error: err?.message ?? "unknown" },
    });
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
  const { orgId } = req.params;
  try {
    const org = await storage.getOrg(orgId);
    if (!org) {
      await logAdminAction(req, {
        eventType: "admin_billing_resynced",
        orgId,
        success: false,
        details: { reason: "not_found" },
      });
      return res.status(404).json({ error: "Organization not found" });
    }
    const before = { plan: org.plan, subscriptionStatus: org.subscriptionStatus ?? null };
    await syncOrgPlanFromStripe(orgId);
    const updated = await storage.getOrg(orgId);
    await logAdminAction(req, {
      eventType: "admin_billing_resynced",
      orgId,
      success: true,
      details: {
        before,
        after: {
          plan: updated?.plan ?? null,
          subscriptionStatus: updated?.subscriptionStatus ?? null,
        },
      },
    });
    res.json({ ok: true, plan: updated?.plan, subscriptionStatus: updated?.subscriptionStatus });
  } catch (err: any) {
    let before: { plan: string | null; subscriptionStatus: string | null } | undefined;
    try {
      const snapshot = await storage.getOrg(orgId);
      if (snapshot) {
        before = {
          plan: snapshot.plan,
          subscriptionStatus: snapshot.subscriptionStatus ?? null,
        };
      }
    } catch {}
    await logAdminAction(req, {
      eventType: "admin_billing_resynced",
      orgId,
      success: false,
      details: { error: err?.message ?? "unknown", ...(before ? { before } : {}) },
    });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/users/:id/superadmin", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { isSuperAdmin } = req.body;

    if (typeof isSuperAdmin !== "boolean") {
      await logAdminAction(req, {
        eventType: "admin_superadmin_toggled",
        targetUserId: id,
        success: false,
        details: {
          reason: "invalid_body",
          receivedType: typeof req.body?.isSuperAdmin,
        },
      });
      return res.status(400).json({ error: "isSuperAdmin must be a boolean" });
    }

    if (id === req.session.userId && !isSuperAdmin) {
      await logAdminAction(req, {
        eventType: "admin_superadmin_toggled",
        targetUserId: id,
        success: false,
        details: { reason: "self_demotion_blocked", requested: { isSuperAdmin } },
      });
      return res.status(400).json({ error: "Cannot remove your own super admin status" });
    }

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      await logAdminAction(req, {
        eventType: "admin_superadmin_toggled",
        targetUserId: id,
        success: false,
        details: { reason: "not_found", requested: { isSuperAdmin } },
      });
      return res.status(404).json({ error: "User not found" });
    }

    await db.update(users).set({ isSuperAdmin }).where(eq(users.id, id));
    await logAdminAction(req, {
      eventType: "admin_superadmin_toggled",
      targetUserId: id,
      success: true,
      details: {
        before: { isSuperAdmin: existing.isSuperAdmin ?? false },
        after: { isSuperAdmin },
      },
    });
    res.json({ ok: true, userId: id, isSuperAdmin });
  } catch (err: any) {
    await logAdminAction(req, {
      eventType: "admin_superadmin_toggled",
      targetUserId: id,
      success: false,
      details: { error: err?.message ?? "unknown" },
    });
    res.status(500).json({ error: err.message });
  }
});

export default router;
