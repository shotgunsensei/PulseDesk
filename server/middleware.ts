import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
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
    return res.status(401).json({ error: "Unauthorized", code: "SESSION_EXPIRED" });
  }
  next();
}

export function requireOrg(req: Request, res: Response, next: NextFunction) {
  if (!req.session.orgId) {
    return res.status(400).json({ error: "No organization selected" });
  }
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized", code: "SESSION_EXPIRED" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isSuperAdmin) {
    return res.status(403).json({ error: "Forbidden: Super admin access required" });
  }
  next();
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 120,
  admin: 100,
  supervisor: 80,
  technician: 60,
  staff: 40,
  readonly: 10,
};

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.orgId) {
      return res.status(401).json({ error: "Unauthorized", code: "SESSION_EXPIRED" });
    }
    const membership = await storage.getMembership(req.session.orgId, req.session.userId);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function requireMinRole(minRole: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.orgId) {
      return res.status(401).json({ error: "Unauthorized", code: "SESSION_EXPIRED" });
    }
    const membership = await storage.getMembership(req.session.orgId, req.session.userId);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }
    const userLevel = ROLE_HIERARCHY[membership.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
