import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, checkPlanLimit } from "../middleware";

const router = Router();

router.get("/api/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getJobs(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const j = await storage.getJob(req.session.orgId!, req.params.id as string);
    if (!j) return res.status(404).send("Job not found");
    res.json(j);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/jobs/:id/events", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const events = await storage.getJobEvents(req.session.orgId!, req.params.id as string);
    res.json(events);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const planCheck = await checkPlanLimit(req.session.orgId!, "jobs");
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: `Job limit reached (${planCheck.limit}). Upgrade your plan to add more jobs.`,
        limitReached: true,
        resource: "jobs",
        current: planCheck.current,
        limit: planCheck.limit,
      });
    }
    const data = { ...req.body };
    data.customerId = data.customerId || null;
    data.scheduledStart = data.scheduledStart ? new Date(data.scheduledStart) : null;
    data.scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : null;
    const j = await storage.createJob(req.session.orgId!, data, req.session.userId!);
    res.json(j);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("scheduledStart" in data) data.scheduledStart = data.scheduledStart ? new Date(data.scheduledStart) : null;
    if ("scheduledEnd" in data) data.scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : null;
    if ("customerId" in data) data.customerId = data.customerId || null;
    const j = await storage.updateJob(req.session.orgId!, req.params.id as string, data);
    if (!j) return res.status(404).send("Job not found");
    res.json(j);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteJob(req.session.orgId!, req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
