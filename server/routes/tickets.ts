import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg } from "../middleware";

const router = Router();

router.get("/api/tickets", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getTickets(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/tickets/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const t = await storage.getTicket(req.session.orgId!, req.params.id);
    if (!t) return res.status(404).send("Ticket not found");
    res.json(t);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/tickets/:id/events", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const events = await storage.getTicketEvents(req.session.orgId!, req.params.id);
    res.json(events);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/tickets", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    data.departmentId = data.departmentId || null;
    data.assetId = data.assetId || null;
    data.assignedTo = data.assignedTo || null;
    data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    const t = await storage.createTicket(req.session.orgId!, data, req.session.userId!);
    res.json(t);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/tickets/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("dueDate" in data) data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if ("departmentId" in data) data.departmentId = data.departmentId || null;
    if ("assetId" in data) data.assetId = data.assetId || null;
    if ("assignedTo" in data) data.assignedTo = data.assignedTo || null;

    const oldTicket = await storage.getTicket(req.session.orgId!, req.params.id);
    const t = await storage.updateTicket(req.session.orgId!, req.params.id, data);
    if (!t) return res.status(404).send("Ticket not found");

    if (data.status && oldTicket && data.status !== oldTicket.status) {
      await storage.createTicketEvent(req.session.orgId!, t.id, "status_change", `Status changed from ${oldTicket.status} to ${data.status}`, req.session.userId!);
    }
    if (data.assignedTo && oldTicket && data.assignedTo !== oldTicket.assignedTo) {
      await storage.createTicketEvent(req.session.orgId!, t.id, "assignment", `Ticket reassigned`, req.session.userId!);
    }

    res.json(t);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/tickets/:id/notes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const event = await storage.createTicketEvent(req.session.orgId!, req.params.id, "note", content, req.session.userId!);
    res.json(event);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/tickets/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteTicket(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/dashboard", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const stats = await storage.getDashboardStats(req.session.orgId!);
    res.json(stats);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
