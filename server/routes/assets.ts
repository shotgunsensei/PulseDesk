import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";

const router = Router();

router.get("/api/assets", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getAssets(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/assets/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const a = await storage.getAsset(req.session.orgId!, req.params.id);
    if (!a) return res.status(404).json({ error: "Asset not found" });
    res.json(a);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/assets", requireAuth, requireOrg, requireMinRole("supervisor"), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (!data.name?.trim()) return res.status(400).json({ error: "Asset name required" });
    data.departmentId = data.departmentId || null;
    const a = await storage.createAsset(req.session.orgId!, data);
    res.json(a);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/assets/:id", requireAuth, requireOrg, requireMinRole("technician"), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("departmentId" in data) data.departmentId = data.departmentId || null;
    const a = await storage.updateAsset(req.session.orgId!, req.params.id, data);
    if (!a) return res.status(404).json({ error: "Asset not found" });
    res.json(a);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/assets/:id", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    await storage.deleteAsset(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
