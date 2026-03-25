import { Router, type Request, type Response } from "express";
import { requireAuth, requireOrg } from "../middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/api/analytics/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const statusResult = await db.execute(sql`
      SELECT
        q.status,
        COUNT(*) as count,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM quote_items qi WHERE qi.quote_id = q.id), 0)
          * (1 + COALESCE(q.tax_rate::numeric, 0) / 100)
          - COALESCE(q.discount::numeric, 0)
        ), 0) as total_value
      FROM quotes q
      WHERE q.org_id = ${orgId}
      GROUP BY q.status
    `);

    const weeklyResult = await db.execute(sql`
      SELECT
        DATE_TRUNC('week', q.created_at) as week,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE q.status = 'accepted') as accepted
      FROM quotes q
      WHERE q.org_id = ${orgId}
        AND q.created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', q.created_at)
      ORDER BY week ASC
    `);

    const totalRow = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COALESCE(AVG(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM quote_items qi WHERE qi.quote_id = q.id), 0)
          * (1 + COALESCE(q.tax_rate::numeric, 0) / 100)
          - COALESCE(q.discount::numeric, 0)
        ), 0) as avg_value
      FROM quotes q
      WHERE q.org_id = ${orgId}
    `);

    const row = totalRow.rows[0] as any;
    const total = Number(row?.total || 0);
    const accepted = Number(row?.accepted || 0);
    const sent = Number(row?.sent || 0);

    res.json({
      total,
      accepted,
      sent,
      draft: Number(row?.draft || 0),
      declined: Number(row?.declined || 0),
      avgValue: Number(Number(row?.avg_value || 0).toFixed(2)),
      acceptanceRate: sent + accepted > 0 ? Math.round((accepted / (accepted + sent)) * 100) : 0,
      byStatus: statusResult.rows.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
        totalValue: Number(Number(r.total_value).toFixed(2)),
      })),
      weekly: weeklyResult.rows.map((r: any) => ({
        week: r.week,
        count: Number(r.count),
        accepted: Number(r.accepted),
      })),
    });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/analytics/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ) FILTER (WHERE status = 'paid'), 0) as collected,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ), 0) as total_value,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ) FILTER (WHERE status = 'sent' AND due_date < NOW()), 0) as overdue_value
      FROM invoices inv
      WHERE inv.org_id = ${orgId}
    `);

    const weeklyResult = await db.execute(sql`
      SELECT
        DATE_TRUNC('week', paid_at) as week,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ), 0) as revenue
      FROM invoices inv
      WHERE inv.org_id = ${orgId}
        AND inv.status = 'paid'
        AND inv.paid_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', paid_at)
      ORDER BY week ASC
    `);

    const agingResult = await db.execute(sql`
      SELECT
        CASE
          WHEN due_date IS NULL THEN 'no_due_date'
          WHEN due_date >= NOW() THEN 'current'
          WHEN NOW() - due_date <= INTERVAL '30 days' THEN '1_30'
          WHEN NOW() - due_date <= INTERVAL '60 days' THEN '31_60'
          WHEN NOW() - due_date <= INTERVAL '90 days' THEN '61_90'
          ELSE 'over_90'
        END as bucket,
        COUNT(*) as count,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ), 0) as value
      FROM invoices inv
      WHERE inv.org_id = ${orgId}
        AND inv.status = 'sent'
      GROUP BY 1
    `);

    const r = overallResult.rows[0] as any;
    const totalValue = Number(r?.total_value || 0);
    const collected = Number(r?.collected || 0);

    res.json({
      total: Number(r?.total || 0),
      paidCount: Number(r?.paid_count || 0),
      collected: Number(collected.toFixed(2)),
      totalValue: Number(totalValue.toFixed(2)),
      overdueValue: Number(Number(r?.overdue_value || 0).toFixed(2)),
      collectionRate: totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0,
      weekly: weeklyResult.rows.map((row: any) => ({
        week: row.week,
        revenue: Number(Number(row.revenue).toFixed(2)),
      })),
      aging: agingResult.rows.map((row: any) => ({
        bucket: row.bucket,
        count: Number(row.count),
        value: Number(Number(row.value).toFixed(2)),
      })),
    });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/analytics/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const statusResult = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM jobs
      WHERE org_id = ${orgId}
      GROUP BY status
    `);

    const weeklyResult = await db.execute(sql`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as created,
        COUNT(*) FILTER (WHERE status IN ('done','invoiced','paid')) as completed
      FROM jobs
      WHERE org_id = ${orgId}
        AND created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week ASC
    `);

    const priorityResult = await db.execute(sql`
      SELECT priority, COUNT(*) as count
      FROM jobs
      WHERE org_id = ${orgId}
      GROUP BY priority
    `);

    res.json({
      byStatus: statusResult.rows.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      weekly: weeklyResult.rows.map((r: any) => ({
        week: r.week,
        created: Number(r.created),
        completed: Number(r.completed),
      })),
      byPriority: priorityResult.rows.map((r: any) => ({
        priority: r.priority,
        count: Number(r.count),
      })),
    });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/api/analytics/customers", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const monthlyResult = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count
      FROM customers
      WHERE org_id = ${orgId}
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);

    const topResult = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        COUNT(DISTINCT j.id) as job_count,
        COALESCE(SUM(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM invoice_items ii WHERE ii.invoice_id = inv.id), 0)
          * (1 + COALESCE(inv.tax_rate::numeric, 0) / 100)
          - COALESCE(inv.discount::numeric, 0)
        ) FILTER (WHERE inv.status = 'paid'), 0) as lifetime_value
      FROM customers c
      LEFT JOIN jobs j ON j.customer_id = c.id AND j.org_id = ${orgId}
      LEFT JOIN invoices inv ON inv.customer_id = c.id AND inv.org_id = ${orgId}
      WHERE c.org_id = ${orgId}
      GROUP BY c.id, c.name
      ORDER BY lifetime_value DESC
      LIMIT 10
    `);

    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM customers WHERE org_id = ${orgId}
    `);

    res.json({
      total: Number((totalResult.rows[0] as any)?.total || 0),
      monthly: monthlyResult.rows.map((r: any) => ({
        month: r.month,
        count: Number(r.count),
      })),
      topByValue: topResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        jobCount: Number(r.job_count),
        lifetimeValue: Number(Number(r.lifetime_value).toFixed(2)),
      })),
    });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
