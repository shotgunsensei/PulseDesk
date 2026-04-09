import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg } from "../middleware";

const router = Router();

router.get("/api/supply-requests", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getSupplyRequests(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/supply-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const s = await storage.getSupplyRequest(req.session.orgId!, req.params.id);
    if (!s) return res.status(404).send("Supply request not found");
    res.json(s);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/supply-requests", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    data.departmentId = data.departmentId || null;
    const s = await storage.createSupplyRequest(req.session.orgId!, data, req.session.userId!);
    res.json(s);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/supply-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("departmentId" in data) data.departmentId = data.departmentId || null;
    const s = await storage.updateSupplyRequest(req.session.orgId!, req.params.id, data);
    if (!s) return res.status(404).send("Supply request not found");
    res.json(s);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/supply-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteSupplyRequest(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
