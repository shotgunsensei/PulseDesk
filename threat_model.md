# PulseDesk — Threat Model

> Last updated: 2026-05-03. STRIDE-style lightweight threat model. Covers the
> production-deployed multi-tenant Express+Drizzle+React stack.

## 1. System summary

PulseDesk is a multi-tenant SaaS for healthcare-facility operations:
ticketing, departments, assets, supply/facility requests, vendors, analytics,
billing, and email-to-ticket. Each customer ("org") is fully isolated via
`org_id` filtering at the storage layer.

- **Frontend:** React 18 + Vite + TanStack Query, served from Express in prod.
- **Backend:** Express + tsx + Drizzle ORM + PostgreSQL (Neon-hosted).
- **Auth:** Local username/password (Argon2id-style hash via crypto.scrypt) +
  per-org Microsoft 365 Entra OAuth (PKCE) and Google Workspace OAuth.
- **Sessions:** Express-session backed by Postgres (connect-pg-simple).
- **Billing:** Stripe Checkout + webhooks → plan sync.
- **Email:** SendGrid Inbound Parse + per-org Google/Microsoft connector OAuth
  + IMAP polling. Outbound delivery TBD.

## 2. Assets (what is worth protecting)

| Asset | Storage | Sensitivity |
|---|---|---|
| User credentials (password hashes) | `users.password_hash` | Critical |
| Session cookies | `session` table + browser | Critical |
| Org-scoped tickets / assets / vendors | tenant tables, gated by `org_id` | High (PHI-adjacent) |
| Stripe customer/subscription IDs | `orgs` row | High |
| Per-org OAuth tokens (Google/Microsoft) | `org_email_connectors`, encrypted | High |
| Per-org Entra client secret | `org_auth_config.entra_client_secret_encrypted` | Critical |
| `SESSION_SECRET` env | runtime env | Critical |
| `STRIPE_WEBHOOK_SECRET` | runtime env | Critical |
| Audit log (`auth_audit_log`) | DB | Medium |

## 3. Trust boundaries

```
Browser <—HTTPS—> Express (Replit deployment) <—SQL—> Neon Postgres
                       │
                       ├─> Stripe API + webhooks (verified by signature)
                       ├─> Microsoft Graph + Entra OAuth (per-org client)
                       ├─> Google OAuth + Gmail API (per-org client)
                       └─> SendGrid Inbound Parse (HTTP POST, alias-based)
```

Boundaries enforced:

1. **Session boundary** — all `/api/*` (except auth, public health, Stripe
   webhook, SendGrid inbound, OAuth callbacks) require `requireAuth`.
2. **Org boundary** — `requireOrg` middleware sets `req.orgId` from session
   membership. Storage methods take `orgId` as a leading parameter.
3. **Role boundary** — `requireMinRole(role)` for admin/manager-only routes.
4. **Super-admin boundary** — `requireSuperAdmin` for `/api/admin/*`.

## 4. STRIDE analysis

### Spoofing

- **Threat:** Credential stuffing → account takeover.
  - **Mitigation:** scrypt-based password hashing, login throttle,
    `auth_audit_log` records every attempt with IP + UA. **Gap:** no rate
    limit on `/api/auth/login` beyond audit log; consider express-rate-limit.
- **Threat:** Forged Stripe webhook → fake plan upgrade.
  - **Mitigation:** signature verified with `STRIPE_WEBHOOK_SECRET` before
    body parse.
- **Threat:** Forged SendGrid inbound payload → ticket spam / cross-org write.
  - **Mitigation:** alias-based routing — payload must include an alias that
    maps to a real org's `email_settings.inbound_alias`. **Gap:** no
    SendGrid IP allowlist or HMAC verification yet.

### Tampering

- **Threat:** Cross-tenant write via crafted `org_id` in request body.
  - **Mitigation:** all storage writes derive `org_id` from
    `req.session.orgId`, never from request body. Body schemas use
    `createInsertSchema(...).omit({ orgId: true })`.
- **Threat:** SQL injection via dynamic identifiers.
  - **Mitigation:** Drizzle parameterized queries throughout. One legacy
    `sql.raw` in billing was replaced with `sql.join(...)`. Drizzle 0.39 has
    a known CVE on `sql.identifier()` — not used in this codebase.

### Repudiation

- **Threat:** Admin action denied.
  - **Mitigation:** `auth_audit_log` records authn events. **Gap:** no audit
    log for high-impact data mutations (org delete, plan change, audit purge).
    See follow-up.

### Information disclosure

- **Threat:** Cross-tenant read via missing `org_id` filter.
  - **Mitigation:** every list query in `server/storage.ts` filters by
    `eq(table.orgId, orgId)`. Search queries use `and(eq, ...)`.
- **Threat:** Leaked Entra client secrets via API.
  - **Mitigation:** `entraClientSecretEncrypted` never returned in responses;
    `getAuthConfig` strips it. Stored AES-256-GCM-encrypted with
    `authTagLength: 16` (hardened in this pass).
- **Threat:** Stack traces in 500s.
  - **Mitigation:** `safeError()` helper sanitizes errors before responding.

### Denial of service

- **Threat:** Pathological inbound emails (huge body) → DB bloat.
  - **Mitigation:** SendGrid limits payload size; processor truncates HTML.
    **Gap:** no per-org rate limit on inbound parse.
- **Threat:** Onboarding-item flood / audit-log flood.
  - **Mitigation:** New `purgeAuthAuditLogsOlderThan(days)` admin tool.

### Elevation of privilege

- **Threat:** Read-only user mutating data.
  - **Mitigation:** `requireMinRole` server-side; UI gates are defense in
    depth only.
- **Threat:** Member of org A acting on org B.
  - **Mitigation:** Session `orgId` re-validated against active membership
    on every authenticated request.
- **Threat:** Super-admin route reachable by org admin.
  - **Mitigation:** `requireSuperAdmin` checks `users.is_super_admin`, set
    only via direct DB.

## 5. Open follow-ups (security debt)

1. Add `express-rate-limit` to `/api/auth/*` and `/api/email/inbound/*`.
2. Add HMAC or IP allowlist for SendGrid inbound webhook.
3. Audit-log destructive admin actions (org delete, plan change, role
   change, audit purge).
4. Upgrade `drizzle-orm` to ≥ 0.45.2 (CVE-2026-39356) and other npm high
   advisories — requires `package.json` edit (out of agent scope per
   guidelines).
5. CSP + HSTS hardening on production responses.
6. Periodic key rotation for `SESSION_SECRET` (re-encrypt Entra secrets).
