import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, checkTeamLimit } from "../middleware";

const router = Router();

router.post("/api/orgs", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, slug, phone, email, address } = req.body;
    if (!name) return res.status(400).send("Organization name required");

    const org = await storage.createOrg({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      phone: phone || "",
      email: email || "",
      address: address || "",
    });

    await storage.createMembership(org.id, req.session.userId!, "owner");
    req.session.orgId = org.id;
    res.json(org);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/orgs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    if (req.params.id !== req.session.orgId) {
      return res.status(403).send("Cannot edit another organization");
    }
    const { plan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, ...safeData } = req.body;
    const org = await storage.updateOrg(req.params.id as string, safeData);
    res.json(org);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/orgs/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const invite = await storage.getInviteCodeByCode(code);
    if (!invite) return res.status(400).send("Invalid invite code");

    const existing = await storage.getMembership(invite.orgId, req.session.userId!);
    if (existing) return res.status(400).send("Already a member");

    const teamCheck = await checkTeamLimit(invite.orgId);
    if (!teamCheck.canInvite) {
      return res.status(403).send(
        "This organization's plan does not allow team invitations. Upgrade to Small Business or Enterprise plan."
      );
    }
    if (!teamCheck.allowed) {
      return res.status(403).send(
        `Team member limit reached (${teamCheck.limit}). Upgrade your plan to add more members.`
      );
    }

    await storage.createMembership(invite.orgId, req.session.userId!, invite.role);
    req.session.orgId = invite.orgId;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/invite-codes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const codes = await storage.getOrgInviteCodes(req.session.orgId!);
    res.json(codes);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/invite-codes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const teamCheck = await checkTeamLimit(req.session.orgId!);
    if (!teamCheck.canInvite) {
      return res.status(403).send(
        "Your plan does not allow team invitations. Upgrade to Small Business or Enterprise plan."
      );
    }

    const { role } = req.body;
    const code = await storage.createInviteCode(req.session.orgId!, role || "tech", req.session.userId!);
    res.json(code);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/plan-info", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const { PLAN_LIMITS } = await import("@shared/schema");
    const org = await storage.getOrg(req.session.orgId!);
    if (!org) return res.status(404).send("Organization not found");
    const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.free;
    const counts = await storage.getOrgCounts(org.id);
    res.json({ plan: org.plan, limits, counts, subscriptionStatus: org.subscriptionStatus });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/memberships", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const mems = await storage.getOrgMemberships(req.session.orgId!);
    const membersWithUsers = await Promise.all(
      mems.map(async (m) => {
        const user = await storage.getUser(m.userId);
        return { ...m, user: user ? { ...user, password: undefined } : null };
      })
    );
    res.json(membersWithUsers);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
