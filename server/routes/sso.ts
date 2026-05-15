import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import {
  loadConfig,
  verifyToken,
  consumeToken,
  peekJti,
  getPublicConfig,
  SsoRejectError,
} from "../auth/operatoros-sso";
import { ssoRateLimiter } from "../middleware/rateLimit";

const router = Router();

async function logAttempt(
  req: Request,
  outcome: string,
  success: boolean,
  details: Record<string, unknown>,
  userId?: string | null,
  orgId?: string | null
) {
  try {
    await storage.createAuthAuditLog({
      orgId: orgId ?? null,
      userId: userId ?? null,
      eventType: `operatoros_sso_${outcome}`,
      authSource: "operatoros",
      tenantResolved: orgId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      details,
      success,
    });
  } catch (err: any) {
    console.error("[sso] audit log write failed:", err.message);
  }
}

function reject(
  req: Request,
  res: Response,
  code: string,
  status: number,
  jti: string | null
) {
  void logAttempt(req, code, false, jti ? { jti } : {});
  return res.status(status).json({ code });
}

router.get("/api/public/sso-config", (_req: Request, res: Response) => {
  const pub = getPublicConfig();
  if (!pub) return res.status(404).json({ error: "sso_not_configured" });
  return res.json(pub);
});

router.get("/sso", ssoRateLimiter, async (req: Request, res: Response) => {
  const tokenRaw = req.query.token;
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  const earlyJti = peekJti(token);

  const cfg = loadConfig();
  if (!cfg) {
    return reject(req, res, "sso_not_configured", 503, earlyJti);
  }

  let claims;
  try {
    claims = await verifyToken(token, cfg);
  } catch (err) {
    if (err instanceof SsoRejectError) {
      return reject(req, res, err.code, err.httpStatus, earlyJti);
    }
    return reject(req, res, "signature_invalid", 401, earlyJti);
  }

  try {
    await consumeToken(claims, cfg);
  } catch (err) {
    if (err instanceof SsoRejectError) {
      return reject(req, res, err.code, err.httpStatus, claims.jti);
    }
    return reject(req, res, "consume_failed", 401, claims.jti);
  }

  let provisioned;
  try {
    provisioned = await storage.provisionOperatorOsUser({
      sub: claims.sub,
      email: claims.email,
      name: claims.name ?? "",
      role: claims.role,
      planSlug: claims.plan_slug,
      organizationId: claims.organization_id,
    });
  } catch (err: any) {
    console.error("[sso] provisioning failed:", err);
    void logAttempt(
      req,
      "provisioning_failed",
      false,
      { jti: claims.jti, message: String(err?.message ?? "") }
    );
    return res.status(500).json({ code: "provisioning_failed" });
  }

  req.session.userId = provisioned.user.id;
  req.session.orgId = provisioned.org.id;
  req.session.authSource = "operatoros";

  req.session.save((err) => {
    if (err) {
      console.error("[sso] session save failed:", err);
      void logAttempt(
        req,
        "session_error",
        false,
        { jti: claims.jti, message: String(err?.message ?? "") },
        provisioned.user.id,
        provisioned.org.id
      );
      return res.status(500).json({ code: "session_error" });
    }
    void logAttempt(
      req,
      "success",
      true,
      { jti: claims.jti, orgCreated: provisioned.orgCreated, userCreated: provisioned.userCreated },
      provisioned.user.id,
      provisioned.org.id
    );
    res.redirect(302, "/dashboard");
  });
});

export default router;
