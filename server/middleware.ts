import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Org, OrgAuthConfig } from "@shared/schema";

export interface ResolvedTenantRequest extends Request {
  resolvedOrg: Org;
  resolvedAuthConfig: OrgAuthConfig | { authMode: string };
}

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

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const slug = req.params.slug || req.query.org as string;

  let org: any = null;

  if (slug) {
    org = await storage.getOrgBySlug(slug);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
  } else if (req.session?.orgId) {
    org = await storage.getOrg(req.session.orgId);
  } else {
    const host = req.hostname;
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "www" && subdomain !== "localhost") {
      org = await storage.getOrgBySlug(subdomain);
    }
  }

  if (!org) {
    return res.status(400).json({ error: "Organization identifier required. Provide org slug, sign in first, or use a subdomain." });
  }

  const authConfig = await storage.getOrgAuthConfig(org.id);

  (req as ResolvedTenantRequest).resolvedOrg = org;
  (req as ResolvedTenantRequest).resolvedAuthConfig = authConfig || { authMode: "local" };
  next();
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
