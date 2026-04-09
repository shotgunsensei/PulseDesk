import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireSuperAdmin } from "../middleware";

const router = Router();

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
    res.status(500).send(err.message);
  }
});

router.delete("/api/admin/orgs/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await storage.deleteOrg(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/admin/users", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map((u) => ({ ...u, password: undefined })));
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
