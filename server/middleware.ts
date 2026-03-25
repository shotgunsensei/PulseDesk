import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { PLAN_LIMITS } from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const BCRYPT_ROUNDS = 12;

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isLegacyHash(storedHash)) {
    const sha256 = crypto.createHash("sha256").update(password).digest("hex");
    return sha256 === storedHash;
  }
  return bcrypt.compare(password, storedHash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

export function requireOrg(req: Request, res: Response, next: NextFunction) {
  if (!req.session.orgId) {
    return res.status(400).send("No organization selected");
  }
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isSuperAdmin) {
    return res.status(403).send("Forbidden: Super admin access required");
  }
  next();
}

export async function checkPlanLimit(
  orgId: string,
  resource: "customers" | "jobs" | "quotes" | "invoices"
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const org = await storage.getOrg(orgId);
  if (!org) return { allowed: false, limit: 0, current: 0 };
  const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.free;
  const maxAllowed = limits[resource];
  if (maxAllowed === -1) return { allowed: true, limit: -1, current: 0 };
  const counts = await storage.getOrgCounts(orgId);
  const current = counts[resource];
  return { allowed: current < maxAllowed, limit: maxAllowed, current };
}

export async function checkTeamLimit(
  orgId: string
): Promise<{ allowed: boolean; limit: number; current: number; canInvite: boolean }> {
  const org = await storage.getOrg(orgId);
  if (!org) return { allowed: false, limit: 0, current: 0, canInvite: false };
  const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.free;
  if (!limits.canInvite) return { allowed: false, limit: limits.teamMembers, current: 0, canInvite: false };
  if (limits.teamMembers === -1) return { allowed: true, limit: -1, current: 0, canInvite: true };
  const counts = await storage.getOrgCounts(org.id);
  return {
    allowed: counts.members < limits.teamMembers,
    limit: limits.teamMembers,
    current: counts.members,
    canInvite: true,
  };
}
