import { Router, type Request, type Response } from "express";
import { requireAuth, requireOrg } from "../middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/api/analytics/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) FILTER (WHERE created_at >= ${thirtyDaysAgo}) as total_30d,
        COUNT(*) FILTER (WHERE status = 'accepted' AND created_at >= ${thirtyDaysAgo}) as accepted_30d,
        COUNT(*) FILTER (WHERE status IN ('accepted','sent') AND created_at >= ${thirtyDaysAgo}) as sent_or_accepted_30d,
        COALESCE(AVG(
          COALESCE((SELECT SUM(qty::numeric * unit_price::numeric) FROM quote_items qi WHERE qi.quote_id = q.id), 0)
          * (1 + COALESCE(q.tax_rate::numeric, 0) / 100)
          - COALESCE(q.discount::numeric, 0)
        ) FILTER (WHERE status != 'draft'), 0) as avg_value
      FROM quotes q
      WHERE q.org_id = ${orgId}
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

    const r = overallResult.rows[0] as any;
    const total = Number(r?.total || 0);
    const accepted = Number(r?.accepted || 0);
    const sent = Number(r?.sent || 0);
    const accepted30d = Number(r?.accepted_30d || 0);
    const sentOrAccepted30d = Number(r?.sent_or_accepted_30d || 0);

    res.json({
      total,
      accepted,
      sent,
      draft: Number(r?.draft || 0),
      declined: Number(r?.declined || 0),
      avgValue: Number(Number(r?.avg_value || 0).toFixed(2)),
      acceptanceRate: sent + accepted > 0 ? Math.round((accepted / (accepted + sent)) * 100) : 0,
      acceptanceRate30d: sentOrAccepted30d > 0 ? Math.round((accepted30d / sentOrAccepted30d) * 100) : 0,
      total30d: Number(r?.total_30d || 0),
      byStatus: statusResult.rows.map((s: any) => ({
        status: s.status,
        count: Number(s.count),
        totalValue: Number(Number(s.total_value).toFixed(2)),
      })),
      weekly: weeklyResult.rows.map((w: any) => ({
        week: w.week,
        count: Number(w.count),
        accepted: Number(w.accepted),
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
        ) FILTER (WHERE status = 'sent' AND due_date < NOW()), 0) as overdue_value,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (paid_at - created_at)) / 86400
        ) FILTER (WHERE status = 'paid' AND paid_at IS NOT NULL), 0) as avg_days_to_payment
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
      avgDaysToPayment: Math.round(Number(r?.avg_days_to_payment || 0)),
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

    const busiestDaysResult = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'Day') as day_name,
        EXTRACT(DOW FROM created_at) as day_num,
        COUNT(*) as count
      FROM jobs
      WHERE org_id = ${orgId}
      GROUP BY day_name, day_num
      ORDER BY day_num ASC
    `);

    const completionRateResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('done','invoiced','paid')) as completed,
        COUNT(*) as total
      FROM jobs
      WHERE org_id = ${orgId}
    `);

    const cr = completionRateResult.rows[0] as any;
    const completionRate = Number(cr?.total || 0) > 0
      ? Math.round((Number(cr?.completed || 0) / Number(cr?.total || 0)) * 100)
      : 0;

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
      completionRate,
      busiestDays: busiestDaysResult.rows.map((r: any) => ({
        day: r.day_name?.trim(),
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

    const repeatResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE job_count > 1) as repeat_customers,
        COUNT(*) as total_with_jobs
      FROM (
        SELECT c.id, COUNT(j.id) as job_count
        FROM customers c
        LEFT JOIN jobs j ON j.customer_id = c.id AND j.org_id = ${orgId}
        WHERE c.org_id = ${orgId}
        GROUP BY c.id
      ) sub
      WHERE job_count > 0
    `);

    const rr = repeatResult.rows[0] as any;
    const repeatCustomers = Number(rr?.repeat_customers || 0);
    const totalWithJobs = Number(rr?.total_with_jobs || 0);
    const repeatRatio = totalWithJobs > 0 ? Math.round((repeatCustomers / totalWithJobs) * 100) : 0;

    res.json({
      total: Number((totalResult.rows[0] as any)?.total || 0),
      repeatCustomers,
      oneTimeCustomers: totalWithJobs - repeatCustomers,
      repeatRatio,
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
