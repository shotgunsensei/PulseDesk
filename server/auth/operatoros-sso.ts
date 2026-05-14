import { jwtVerify, errors as joseErrors } from "jose";

export interface OperatorOsSsoConfig {
  secret: string;
  audience: string;
  env: string;
  apiUrl: string;
  baseUrl: string;
}

export interface OperatorOsTokenClaims {
  iss: string;
  aud: string;
  env: string;
  iat: number;
  exp: number;
  jti: string;
  sub: string;
  user_id: string;
  email: string;
  role: "user" | "super_admin";
  plan_slug: "starter" | "pro" | "elite" | null;
  organization_id: string | null;
  name?: string;
}

export class SsoRejectError extends Error {
  constructor(public code: string, public httpStatus: number) {
    super(code);
    this.name = "SsoRejectError";
  }
}

export function peekJti(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload?.jti === "string" ? payload.jti : null;
  } catch {
    return null;
  }
}

const CLOCK_SKEW_S = 5;
const MAX_TOKEN_AGE_S = 90;
const CONSUME_TIMEOUT_MS = 5000;

export function loadConfig(): OperatorOsSsoConfig | null {
  const secret = process.env.MODULE_SSO_SECRET;
  const audience = process.env.OPERATOROS_SSO_AUDIENCE;
  const env = process.env.OPERATOROS_SSO_ENV;
  const apiUrl = process.env.OPERATOROS_API_URL;
  const baseUrl = process.env.OPERATOROS_BASE_URL;
  if (!secret || !audience || !env || !apiUrl || !baseUrl) return null;
  return { secret, audience, env, apiUrl, baseUrl };
}

function isValidRole(r: unknown): r is "user" | "super_admin" {
  return r === "user" || r === "super_admin";
}

export async function verifyToken(
  token: string,
  cfg: OperatorOsSsoConfig
): Promise<OperatorOsTokenClaims> {
  if (!token || typeof token !== "string") {
    throw new SsoRejectError("missing_token", 400);
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new SsoRejectError("bad_request", 400);
  }

  let header: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new SsoRejectError("bad_request", 400);
  }
  if (header?.alg !== "HS256") {
    throw new SsoRejectError("unsupported_alg", 401);
  }

  const key = new TextEncoder().encode(cfg.secret);
  const expectedIssuer = cfg.baseUrl.replace(/\/+$/, "");
  let payload: any;
  try {
    const result = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      audience: cfg.audience,
      issuer: expectedIssuer,
      clockTolerance: CLOCK_SKEW_S,
    });
    payload = result.payload;
  } catch (err: any) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new SsoRejectError("expired", 401);
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      if (err.claim === "aud") {
        throw new SsoRejectError("audience_mismatch", 401);
      }
      if (err.claim === "iss") {
        throw new SsoRejectError("issuer_mismatch", 401);
      }
      throw new SsoRejectError("claim_invalid", 401);
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new SsoRejectError("signature_invalid", 401);
    }
    throw new SsoRejectError("token_invalid", 401);
  }

  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    throw new SsoRejectError("claim_invalid", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.iat - CLOCK_SKEW_S > now) {
    throw new SsoRejectError("clock_skew", 401);
  }
  if (now - payload.iat > MAX_TOKEN_AGE_S + CLOCK_SKEW_S) {
    throw new SsoRejectError("expired", 401);
  }
  if (payload.env !== cfg.env) {
    throw new SsoRejectError("env_mismatch", 401);
  }
  if (typeof payload.jti !== "string" || payload.jti.length === 0) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (typeof payload.user_id !== "string" || payload.user_id !== payload.sub) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (!isValidRole(payload.role)) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (
    payload.plan_slug !== null &&
    payload.plan_slug !== "starter" &&
    payload.plan_slug !== "pro" &&
    payload.plan_slug !== "elite"
  ) {
    throw new SsoRejectError("claim_invalid", 401);
  }
  if (
    payload.organization_id !== null &&
    typeof payload.organization_id !== "string"
  ) {
    throw new SsoRejectError("claim_invalid", 401);
  }

  return {
    iss: String(payload.iss ?? ""),
    aud: cfg.audience,
    env: payload.env,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
    sub: payload.sub,
    user_id: payload.user_id,
    email: payload.email,
    role: payload.role,
    plan_slug: payload.plan_slug,
    organization_id: payload.organization_id,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

export async function consumeToken(
  claims: OperatorOsTokenClaims,
  cfg: OperatorOsSsoConfig
): Promise<void> {
  const url = `${cfg.apiUrl.replace(/\/+$/, "")}/v1/modules/sso/consume`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONSUME_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.secret}`,
        "X-Module-Slug": "pulsedesk",
      },
      body: JSON.stringify({
        jti: claims.jti,
        aud: claims.aud,
        env: claims.env,
      }),
      signal: ctrl.signal,
    });
  } catch (err: any) {
    throw new SsoRejectError("sso_consume_unavailable", 502);
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 200 && res.status < 300) return;

  if (res.status >= 500) {
    throw new SsoRejectError("sso_consume_unavailable", 502);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  const code: string = body?.code || body?.error || "";

  switch (code) {
    case "TOKEN_UNKNOWN":
    case "TOKEN_REPLAYED":
      throw new SsoRejectError("consume_failed", 401);
    case "TOKEN_EXPIRED":
      throw new SsoRejectError("expired", 401);
    case "AUDIENCE_MISMATCH":
      throw new SsoRejectError("audience_mismatch", 401);
    case "ENV_MISMATCH":
      throw new SsoRejectError("env_mismatch", 401);
    default:
      throw new SsoRejectError("consume_failed", 401);
  }
}
