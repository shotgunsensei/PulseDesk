import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, checkPlanLimit } from "../middleware";

const router = Router();

router.get("/api/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getQuotes(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/quotes/:id/public", async (req: Request, res: Response) => {
  try {
    const q = await storage.getQuotePublic(req.params.id as string);
    if (!q) return res.status(404).send("Quote not found");
    const token = req.query.token as string | undefined;
    if (!token || token !== q.publicToken) {
      return res.status(403).send("Invalid or missing share token");
    }
    res.json(q);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const q = await storage.getQuote(req.session.orgId!, req.params.id as string);
    if (!q) return res.status(404).send("Quote not found");
    const org = await storage.getOrg(req.session.orgId!);
    res.json({ ...q, org });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const planCheck = await checkPlanLimit(req.session.orgId!, "quotes");
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: `Quote limit reached (${planCheck.limit}). Upgrade your plan to add more quotes.`,
        limitReached: true,
        resource: "quotes",
        current: planCheck.current,
        limit: planCheck.limit,
      });
    }
    const q = await storage.createQuote(req.session.orgId!, req.body, req.session.userId!);
    res.json(q);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const q = await storage.updateQuote(req.session.orgId!, req.params.id as string, req.body);
    if (!q) return res.status(404).send("Quote not found");
    res.json(q);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteQuote(req.session.orgId!, req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/quotes/:id/convert-to-job", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const planCheck = await checkPlanLimit(req.session.orgId!, "jobs");
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: `Job limit reached (${planCheck.limit}). Upgrade your plan to add more jobs.`,
        limitReached: true,
      });
    }

    const quote = await storage.getQuote(req.session.orgId!, req.params.id as string);
    if (!quote) return res.status(404).send("Quote not found");

    const job = await storage.createJob(
      req.session.orgId!,
      {
        title: `Job from Quote #${quote.id.slice(0, 8)}`,
        description: quote.notes || "",
        customerId: quote.customerId || null,
        status: "scheduled",
      },
      req.session.userId!
    );

    await storage.updateQuote(req.session.orgId!, req.params.id as string, {
      status: "accepted",
      jobId: job.id,
    });

    res.json(job);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
