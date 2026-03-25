import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, checkPlanLimit } from "../middleware";

const router = Router();

router.get("/api/customers", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getCustomers(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const c = await storage.getCustomer(req.session.orgId!, req.params.id as string);
    if (!c) return res.status(404).send("Customer not found");
    res.json(c);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/customers/:id/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getCustomerJobs(req.session.orgId!, req.params.id as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/customers/:id/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getCustomerInvoices(req.session.orgId!, req.params.id as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/customers", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const planCheck = await checkPlanLimit(req.session.orgId!, "customers");
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: `Customer limit reached (${planCheck.limit}). Upgrade your plan to add more customers.`,
        limitReached: true,
        resource: "customers",
        current: planCheck.current,
        limit: planCheck.limit,
      });
    }
    const c = await storage.createCustomer(req.session.orgId!, req.body);
    res.json(c);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const c = await storage.updateCustomer(req.session.orgId!, req.params.id as string, req.body);
    if (!c) return res.status(404).send("Customer not found");
    res.json(c);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteCustomer(req.session.orgId!, req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/customers/import", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const { customers: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No customers provided" });
    }

    const orgId = req.session.orgId!;
    const planCheck = await checkPlanLimit(orgId, "customers");
    if (planCheck.limit !== -1) {
      const remaining = planCheck.limit - planCheck.current;
      if (remaining <= 0) {
        return res.status(403).json({
          error: `Customer limit reached (${planCheck.limit}). Upgrade your plan to add more customers.`,
          limitReached: true,
        });
      }
      if (rows.length > remaining) {
        return res.status(403).json({
          error: `Import would exceed your plan limit. You can add ${remaining} more customer(s) on your current plan.`,
          limitReached: true,
        });
      }
    }

    let imported = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row.name || "").trim();
      if (!name) {
        errors.push({ row: i + 2, error: "Name is required" });
        continue;
      }
      try {
        await storage.createCustomer(orgId, {
          name,
          phone: (row.phone || "").trim(),
          email: (row.email || "").trim(),
          address: (row.address || "").trim(),
          notes: (row.notes || "").trim(),
        });
        imported++;
      } catch (err: any) {
        errors.push({ row: i + 2, error: err.message });
      }
    }

    res.json({ imported, errors });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
