import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";
import { PLAN_LIMITS } from "@shared/schema";

const router = Router();

router.get("/api/tickets", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getTickets(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/tickets/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const t = await storage.getTicket(req.session.orgId!, req.params.id);
    if (!t) return res.status(404).json({ error: "Ticket not found" });
    res.json(t);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/tickets/:id/events", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const events = await storage.getTicketEvents(req.session.orgId!, req.params.id);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/tickets", requireAuth, requireOrg, requireMinRole("staff"), async (req: Request, res: Response) => {
  try {
    const org = await storage.getOrg(req.session.orgId!);
    const plan = (org as any)?.plan || "free";
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    if (limits.maxTickets !== Infinity) {
      const counts = await storage.getOrgCounts(req.session.orgId!);
      if (counts.tickets >= limits.maxTickets) {
        return res.status(403).json({ error: `Ticket limit reached (${limits.maxTickets}). Upgrade your plan for more.` });
      }
    }

    const data = { ...req.body };
    if (!data.title?.trim() || data.title.trim().length < 3) {
      return res.status(400).json({ error: "Title is required (minimum 3 characters)" });
    }
    if (!data.category) {
      return res.status(400).json({ error: "Category is required" });
    }
    if (!data.priority) {
      return res.status(400).json({ error: "Priority is required" });
    }
    data.title = data.title.trim();
    data.description = data.description?.trim() || "";
    data.departmentId = data.departmentId || null;
    data.assetId = data.assetId || null;
    data.assignedTo = data.assignedTo || null;
    data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    const t = await storage.createTicket(req.session.orgId!, data, req.session.userId!);

    storage.notifyOrgMembers(
      req.session.orgId!, req.session.userId!,
      "ticket_created",
      "New ticket created",
      `${t.ticketNumber} — ${t.title}`,
      t.id,
      data.assignedTo || null
    );

    res.json(t);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/tickets/:id", requireAuth, requireOrg, requireMinRole("technician"), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if ("dueDate" in data) data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if ("departmentId" in data) data.departmentId = data.departmentId || null;
    if ("assetId" in data) data.assetId = data.assetId || null;
    if ("assignedTo" in data) data.assignedTo = data.assignedTo || null;

    const oldTicket = await storage.getTicket(req.session.orgId!, req.params.id);
    const t = await storage.updateTicket(req.session.orgId!, req.params.id, data);
    if (!t) return res.status(404).json({ error: "Ticket not found" });

    if (data.status && oldTicket && data.status !== oldTicket.status) {
      await storage.createTicketEvent(req.session.orgId!, t.id, "status_change", `Status changed from ${oldTicket.status} to ${data.status}`, req.session.userId!);

      const notifType = data.status === "escalated" ? "ticket_escalated" : "ticket_status_changed";
      storage.notifyOrgMembers(
        req.session.orgId!, req.session.userId!,
        notifType,
        data.status === "escalated" ? "Ticket escalated" : "Ticket status updated",
        `${oldTicket.ticketNumber} — ${data.status === "escalated" ? "Requires review" : `Now ${data.status.replace(/_/g, " ")}`}`,
        t.id,
        oldTicket.assignedTo || null
      );
    }
    if (data.assignedTo && oldTicket && data.assignedTo !== oldTicket.assignedTo) {
      await storage.createTicketEvent(req.session.orgId!, t.id, "assignment", `Ticket reassigned`, req.session.userId!);

      storage.notifyOrgMembers(
        req.session.orgId!, req.session.userId!,
        "ticket_assigned",
        "Ticket assigned to you",
        `${oldTicket.ticketNumber} — ${oldTicket.title}`,
        t.id,
        data.assignedTo
      );
    }

    res.json(t);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/tickets/:id/notes", requireAuth, requireOrg, requireMinRole("staff"), async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Note content required" });
    const event = await storage.createTicketEvent(req.session.orgId!, req.params.id, "note", content, req.session.userId!);

    const ticket = await storage.getTicket(req.session.orgId!, req.params.id);
    if (ticket) {
      storage.notifyOrgMembers(
        req.session.orgId!, req.session.userId!,
        "ticket_note_added",
        "Note added to ticket",
        `${ticket.ticketNumber} — New update`,
        ticket.id,
        ticket.assignedTo || null
      );
    }

    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/tickets/:id", requireAuth, requireOrg, requireMinRole("supervisor"), async (req: Request, res: Response) => {
  try {
    await storage.deleteTicket(req.session.orgId!, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/dashboard", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const stats = await storage.getDashboardStats(req.session.orgId!);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
