import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg } from "../middleware";

const router = Router();

router.get("/api/facility-requests", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getFacilityRequests(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/facility-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const f = await storage.getFacilityRequest(req.session.orgId!, req.params.id);
    if (!f) return res.status(404).send("Facility request not found");
    res.json(f);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/facility-requests", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    data.assignedTo = data.assignedTo || null;
    const f = await storage.createFacilityRequest(req.session.orgId!, data, req.session.userId!);
    res.json(f);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/facility-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("assignedTo" in data) data.assignedTo = data.assignedTo || null;
    const f = await storage.updateFacilityRequest(req.session.orgId!, req.params.id, data);
    if (!f) return res.status(404).send("Facility request not found");
    res.json(f);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/facility-requests/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteFacilityRequest(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
