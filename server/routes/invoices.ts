import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, checkPlanLimit } from "../middleware";

const router = Router();

router.get("/api/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const result = await storage.getInvoices(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/invoices/export/quickbooks", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const allInvoices = await storage.getInvoices(req.session.orgId!);
    const rows: string[] = [];
    const headers = [
      "InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Status",
      "ItemDescription", "Qty", "UnitPrice", "LineTotal",
      "Subtotal", "TaxRate%", "TaxAmount", "Discount", "Total", "Notes",
    ];
    rows.push(headers.join(","));

    for (const inv of allInvoices) {
      const full = await storage.getInvoice(req.session.orgId!, inv.id);
      if (!full) continue;
      const items = full.items || [];
      const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0);
      const taxAmount = subtotal * (Number(inv.taxRate) / 100);
      const discount = Number(inv.discount) || 0;
      const total = subtotal + taxAmount - discount;
      const invoiceDate = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-US") : "";
      const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-US") : "";
      const invoiceNo = inv.id.slice(0, 8).toUpperCase();
      const customer = (inv.customerName || "").replace(/,/g, " ");
      const notes = (inv.notes || "").replace(/,/g, " ").replace(/\n/g, " ");

      if (items.length === 0) {
        rows.push(
          [
            invoiceNo, customer, invoiceDate, dueDate, inv.status,
            "", "", "", "",
            subtotal.toFixed(2), Number(inv.taxRate).toFixed(2), taxAmount.toFixed(2),
            discount.toFixed(2), total.toFixed(2), notes,
          ]
            .map((v) => `"${v}"`)
            .join(",")
        );
      } else {
        items.forEach((item, idx) => {
          const lineTotal = Number(item.qty) * Number(item.unitPrice);
          const desc = (item.description || "").replace(/"/g, "'");
          rows.push(
            [
              invoiceNo, customer, invoiceDate, dueDate, inv.status,
              desc, Number(item.qty).toFixed(2), Number(item.unitPrice).toFixed(2), lineTotal.toFixed(2),
              idx === 0 ? subtotal.toFixed(2) : "",
              idx === 0 ? Number(inv.taxRate).toFixed(2) : "",
              idx === 0 ? taxAmount.toFixed(2) : "",
              idx === 0 ? discount.toFixed(2) : "",
              idx === 0 ? total.toFixed(2) : "",
              idx === 0 ? notes : "",
            ]
              .map((v) => `"${v}"`)
              .join(",")
          );
        });
      }
    }

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoices-quickbooks-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const inv = await storage.getInvoice(req.session.orgId!, req.params.id as string);
    if (!inv) return res.status(404).send("Invoice not found");
    const org = await storage.getOrg(req.session.orgId!);
    res.json({ ...inv, org });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.post("/api/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const planCheck = await checkPlanLimit(req.session.orgId!, "invoices");
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: `Invoice limit reached (${planCheck.limit}). Upgrade your plan to add more invoices.`,
        limitReached: true,
        resource: "invoices",
        current: planCheck.current,
        limit: planCheck.limit,
      });
    }
    const inv = await storage.createInvoice(req.session.orgId!, req.body, req.session.userId!);
    res.json(inv);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.patch("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const inv = await storage.updateInvoice(req.session.orgId!, req.params.id as string, req.body);
    if (!inv) return res.status(404).send("Invoice not found");
    res.json(inv);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.delete("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    await storage.deleteInvoice(req.session.orgId!, req.params.id as string);
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
