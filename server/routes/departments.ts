import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";

const router = Router();

router.get("/api/departments", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getDepartments(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/departments/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const d = await storage.getDepartment(req.session.orgId!, req.params.id);
    if (!d) return res.status(404).json({ error: "Department not found" });
    res.json(d);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/departments", requireAuth, requireOrg, requireMinRole("supervisor"), async (req: Request, res: Response) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ error: "Department name required" });
    const d = await storage.createDepartment(req.session.orgId!, req.body);
    res.json(d);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/departments/:id", requireAuth, requireOrg, requireMinRole("supervisor"), async (req: Request, res: Response) => {
  try {
    const d = await storage.updateDepartment(req.session.orgId!, req.params.id, req.body);
    if (!d) return res.status(404).json({ error: "Department not found" });
    res.json(d);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/departments/:id", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    await storage.deleteDepartment(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
