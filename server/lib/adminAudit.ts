import type { Request } from "express";
import { storage } from "../storage";

function getClientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]?.trim() || null;
  }
  return req.ip || null;
}

export type AdminAuditEventType =
  | "admin_org_deleted"
  | "admin_org_plan_changed"
  | "admin_membership_role_changed"
  | "admin_audit_log_purged"
  | "org_membership_role_changed";

export async function logAdminAction(
  req: Request,
  params: {
    eventType: AdminAuditEventType;
    orgId?: string | null;
    targetUserId?: string | null;
    success: boolean;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await storage.createAuthAuditLog({
      orgId: params.orgId ?? null,
      userId: req.session?.userId ?? null,
      eventType: params.eventType,
      authSource: "admin",
      ipAddress: getClientIp(req),
      userAgent: (req.headers["user-agent"] as string) || null,
      details: {
        actorUserId: req.session?.userId ?? null,
        targetUserId: params.targetUserId ?? null,
        ...(params.details || {}),
      },
      success: params.success,
    });
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}
