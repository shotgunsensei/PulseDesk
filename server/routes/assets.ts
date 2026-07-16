import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg, requireMinRole } from "../middleware";
import { validateTicketTenantReferences } from "./serviceDesk";
import { db } from "../db";
import { activityEvents } from "@shared/schema";

const router = Router();

router.get("/api/assets", requireAuth, requireOrg, async (req, res) => {
  try {
    const result = await storage.getAssets(req.session.orgId!);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

router.get("/api/assets/:id", requireAuth, requireOrg, async (req, res) => {
  try {
    const a = await storage.getAsset(req.session.orgId!, (req.params.id as string));
    if (!a) return res.status(404).json({ error: "Asset not found" });
    res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

router.post("/api/assets", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.name?.trim()) return res.status(400).json({ error: "Asset name required" });
    data.departmentId = data.departmentId || null;
    data.clientId = data.clientId || null;
    data.siteId = data.siteId || null;
    data.assignedUserId = data.assignedUserId || null;
    for (const field of ["purchaseDate", "warrantyStart", "warrantyEnd"]) data[field] = data[field] ? new Date(data[field]) : null;
    await validateTicketTenantReferences(req.session.orgId!, { clientId: data.clientId, siteId: data.siteId, departmentId: data.departmentId, assignedTo: data.assignedUserId });
    const a = await storage.createAsset(req.session.orgId!, data);
    await db.insert(activityEvents).values({ orgId: req.session.orgId!, actorUserId: req.session.userId!, entityType: "asset", entityId: a.id, action: "created", summary: `Asset ${a.assetTag} created`, after: a as any, ipAddress: req.ip ?? null });
    res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

router.patch("/api/assets/:id", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  try {
    const data = { ...req.body };
    if ("departmentId" in data) data.departmentId = data.departmentId || null;
    if ("clientId" in data) data.clientId = data.clientId || null;
    if ("siteId" in data) data.siteId = data.siteId || null;
    if ("assignedUserId" in data) data.assignedUserId = data.assignedUserId || null;
    for (const field of ["purchaseDate", "warrantyStart", "warrantyEnd"]) if (field in data) data[field] = data[field] ? new Date(data[field]) : null;
    await validateTicketTenantReferences(req.session.orgId!, { clientId: data.clientId, siteId: data.siteId, departmentId: data.departmentId, assignedTo: data.assignedUserId });
    const before = await storage.getAsset(req.session.orgId!, (req.params.id as string));
    const a = await storage.updateAsset(req.session.orgId!, (req.params.id as string), data);
    if (!a) return res.status(404).json({ error: "Asset not found" });
    await db.insert(activityEvents).values({ orgId: req.session.orgId!, actorUserId: req.session.userId!, entityType: "asset", entityId: a.id, action: "updated", summary: `Asset ${a.assetTag} updated`, before: before as any, after: a as any, ipAddress: req.ip ?? null });
    res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

router.delete("/api/assets/:id", requireAuth, requireOrg, requireMinRole("admin"), async (req, res) => {
  try {
    const deleted = await storage.deleteAsset(req.session.orgId!, (req.params.id as string));
    if (!deleted) return res.status(404).json({ error: "Asset not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
