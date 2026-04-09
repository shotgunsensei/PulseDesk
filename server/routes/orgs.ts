import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg } from "../middleware";
import { DEFAULT_DEPARTMENTS } from "@shared/schema";

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

    await storage.createMembership(org.id, req.session.userId!, "admin");
    req.session.orgId = org.id;

    for (const deptName of DEFAULT_DEPARTMENTS) {
      await storage.createDepartment(org.id, { name: deptName });
    }

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
    const org = await storage.updateOrg(req.params.id, req.body);
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
    const { role } = req.body;
    const code = await storage.createInviteCode(req.session.orgId!, role || "staff", req.session.userId!);
    res.json(code);
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

router.patch("/api/memberships/:userId/role", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { role } = req.body;
    if (!["admin", "supervisor", "staff", "technician", "readonly"].includes(role)) {
      return res.status(400).send("Invalid role");
    }
    const myMembership = await storage.getMembership(req.session.orgId!, req.session.userId!);
    if (!myMembership || myMembership.role !== "admin") {
      return res.status(403).send("Only admins can change roles");
    }
    if (userId === req.session.userId) {
      return res.status(400).send("Cannot change your own role");
    }
    await storage.updateMembershipRole(req.session.orgId!, userId, role);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/memberships/:userId", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (userId === req.session.userId) {
      return res.status(400).send("Cannot remove yourself");
    }
    const myMembership = await storage.getMembership(req.session.orgId!, req.session.userId!);
    if (!myMembership || myMembership.role !== "admin") {
      return res.status(403).send("Only admins can remove members");
    }
    await storage.deleteMembership(req.session.orgId!, userId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
