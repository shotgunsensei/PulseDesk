# PulseDesk OperatorOS Integration Plan

Phase 0 audit date: 2026-06-29

## Current State

PulseDesk is a React + Vite + TypeScript frontend with an Express backend, Drizzle ORM, PostgreSQL, and `express-session` backed by `connect-pg-simple`.

The current auth model is mixed:

- Local username/password auth in `server/routes/auth.ts`.
- Per-org Microsoft 365 / Entra auth config in `org_auth_config`, with JIT provisioning and role mappings.
- Session state in `req.session.userId`, `req.session.orgId`, and `req.session.authSource`.
- Org membership and role enforcement through `memberships`, `requireAuth`, `requireOrg`, `requireRole`, and `requireMinRole`.
- Super-admin access through `users.isSuperAdmin`, protected by `requireSuperAdmin`.

The current OperatorOS SSO receiver is identity-first, not entitlement-first:

- `GET /sso?token=...` is implemented in `server/routes/sso.ts`.
- JWT verification lives in `server/auth/operatoros-sso.ts`.
- Provisioning lives in `storage.provisionOperatorOsUser`.
- SSO columns are present in `users` and `orgs`, with migrations in `server/migrate.ts`.
- The receiver verifies HS256, issuer, audience, environment, token age, `module_slug`, `sub`, `user_id`, email, role, `plan_slug`, and `organization_id`.
- The receiver calls `consumeToken()` before creating a child session.
- The receiver prefers `OPERATOROS_SSO_CONSUME_URL`, falls back to safe `OPERATOROS_API_URL` consume URL resolution, and does not append duplicate `/api` or `/v1` path segments.
- The receiver preserves successful consume JSON when present and uses JWT/consume entitlement signals for tenant id, plan slug, target module status, and local role mapping.
- The receiver stores OperatorOS user/org identifiers and plan metadata. OperatorOS `super_admin` or the master-admin email maps to local `isSuperAdmin=true` and tenant `owner`; OperatorOS `admin` maps to tenant `admin`; `member`/`user` map to `staff` unless entitlement claims explicitly grant owner/admin/module-admin/manager access.

The current billing and entitlement model is still PulseDesk-local:

- Stripe billing routes are in `server/routes/billing.ts`.
- Stripe client setup is in `server/stripeClient.ts`.
- Webhook processing and org sync are in `server/webhookHandlers.ts` and `server/services/billingSync.ts`.
- Plan metadata is duplicated in `shared/billingConfig.ts` and surfaced through `server/config/billingConfig.ts`.
- Backend feature gates read local `org.plan` through `PLAN_LIMITS`, especially `entraEnabled` and `emailToTicket`.
- UI pricing and upsell text lives in `client/src/pages/billing.tsx`, `client/src/pages/settings.tsx`, `client/src/pages/auth-page.tsx`, `client/src/pages/admin.tsx`, and `client/src/components/app-sidebar.tsx`.

The current master admin model is not production-safe:

- `server/seed.ts` creates a hardcoded `Johntwms355` super admin with a hardcoded password.
- Admin toggling is local-user based through `PATCH /api/admin/users/:id/superadmin`.
- This must be replaced with an email-based bootstrap model before production use.

## OperatorOS Contract Mismatches

The copied OperatorOS docs make OperatorOS the access authority, not just the identity provider:

- `MODULE_SSO.md` expects SSO to carry an entitlement snapshot including `operatoros_tenant_id`, tenant role aliases, subscription status, `target_module_enabled`, `target_module_access_level`, `target_module_role`, `target_module_features`, and `all_enabled_modules`.
- PulseDesk currently accepts the older identity-shaped claims: `organization_id`, `role`, and `plan_slug`.
- `CHILD_APP_ENTITLEMENT_PROMPT.md` requires cached entitlement snapshots, stale snapshot refresh, webhook revocation, and S2S introspection.
- PulseDesk currently has no OperatorOS entitlement cache, webhook receiver, service-token introspection, or entitlement-sync registration.
- `sso-module-access.md` says child apps must not recreate feature-level pricing checks.
- PulseDesk currently derives feature access from local `org.plan` and Stripe state.
- `operatoros-env-vars.md` centralizes PulseDesk pricing in OperatorOS with `STRIPE_PRICE_PULSEDESK_MONTHLY`; PulseDesk still uses local Stripe plan products, local checkout, local portal, and local plan admin edits.
- `child-sso-integration-prompt.md` and `MODULE_SSO.md` both require `/sso` and HS256 verification, but they differ on consume URL/body expectations. PulseDesk currently posts to `OPERATOROS_API_URL` as a full URL with `{ jti, aud, env }` because prior live validation found the deployed consume path at `https://operatoros.net/api/modules/sso/consume`.
- Phase 1 keeps the verified `{ jti, aud, env }` consume body and supports either the legacy alias or versioned consume endpoint, but the preferred child-app configuration is now an explicit full consume URL in `OPERATOROS_SSO_CONSUME_URL`.

## Target State

OperatorOS is the source of truth for PulseDesk launch access, subscription status, module role, feature flags, and entitlement revocation.

PulseDesk should keep its healthcare workflow data, org-scoped records, local role enforcement, and session cookie, but it should stop treating local Stripe state as the authority for whether a tenant can use paid PulseDesk capabilities.

Target auth and entitlement behavior:

- `/sso` accepts OperatorOS launches, verifies HS256, validates `aud` and `module_slug === pulsedesk`, enforces TTL/replay/consume, and creates only a PulseDesk child session.
- PulseDesk stores OperatorOS user id, tenant id, tenant role alias, module role, subscription status, feature map, all enabled module slugs, and `computedAt`.
- `target_module_enabled === false` prevents a working PulseDesk session and redirects to a locked or relaunch view.
- Sensitive feature checks use the cached OperatorOS module snapshot first.
- Stale snapshots are refreshed through `GET {OPERATOROS_API_URL}/v1/sso/entitlements/introspect?user_id=...&tenant_id=...` with `OPERATOROS_SERVICE_TOKEN`.
- `POST /webhooks/operatoros/entitlements` verifies `X-Operatoros-Signature` with `MODULE_SSO_SECRET`, updates cached entitlement state, and revokes access when PulseDesk is disabled or missing from the module list.
- Local plan gates remain only as temporary backward compatibility until OperatorOS entitlement coverage is verified.

Target admin behavior:

- Replace hardcoded `Johntwms355` seed logic with an email-based bootstrap such as `PULSEDESK_MASTER_ADMIN_EMAIL`.
- Promote an existing user by normalized email, or create an admin only when an explicit bootstrap email and non-default bootstrap password are configured.
- Block self-demotion, keep audit logs, and avoid username-only super-admin identity.

## Migration Phases

### Phase 0: Baseline Stabilization

- Keep behavior unchanged.
- Fix compile-only interface drift.
- Document the current contract map and target migration path.
- Verify `npm run check` and `npm run build`.

### Phase 1: SSO Receiver Hardening And Session Normalization

- Enforce `/sso?token=...` as the production login path.
- Reject missing tokens with `400 { "code": "missing_token" }`.
- Require HS256 only, reject `alg=none`, normalize issuer trailing slashes, enforce audience/module slug, environment, issued-at, expiration, and a 90-second max token age.
- Make consume mandatory before local session creation.
- Preserve consume JSON and use entitlement snapshot signals for target-module denial and role mapping.
- Recognize `john@shotgunninjas.com` and `PULSEDESK_MASTER_ADMIN_EMAIL` as master-admin identities only after OperatorOS authentication.
- Gate local username/password register/login behind `PULSEDESK_LOCAL_AUTH_ENABLED=true` for development or reviewer workflows.
- Keep `requireSuperAdmin` and admin routes intact during the transition.

### Phase 1B: Safe Local Master Admin Bootstrap

- Replace `ensureSuperAdmin()` hardcoded username/password behavior.
- Add an idempotent local bootstrap path keyed by normalized email if an emergency local fallback is still needed.
- Add audit entries for bootstrap promotion and super-admin toggles.

### Phase 2: Entitlement Snapshot Data Model

- Add local storage for OperatorOS entitlement snapshots keyed by `(operatorOsUserId, operatorOsTenantId, moduleSlug)`.
- Store `computedAt`, `subscriptionStatus`, `moduleEnabled`, `moduleRole`, `accessLevel`, `features`, `limits`, `capabilities`, and raw snapshot metadata.
- Add migrations and storage methods only; do not wire enforcement until tests exist.

### Phase 3: SSO Contract Refresh

- Extend `OperatorOsTokenClaims` to accept the current entitlement claims from `MODULE_SSO.md`.
- Preserve compatibility with existing `organization_id` / `plan_slug` claims during rollout.
- Enforce `target_module_enabled` before creating a working session.
- Store the entitlement snapshot at SSO time.
- Reconcile the consume URL/body shape with the live OperatorOS deployment before changing `consumeToken()`.

### Phase 4: Webhook and Introspection

- Add raw-body handling for `POST /webhooks/operatoros/entitlements`.
- Verify `X-Operatoros-Signature` with constant-time HMAC comparison.
- Ignore older `computedAt` snapshots.
- Revoke sessions or block subsequent requests when PulseDesk entitlement is disabled.
- Register or document registration through `POST /v1/sso/entitlements/sync`.
- Add on-demand introspection for stale or missing snapshots.

### Phase 5: Replace Local Billing Authority

- Convert PulseDesk billing UI into an OperatorOS-managed billing/plan page.
- Replace local checkout and portal calls with OperatorOS links or launch flows.
- Stop using local Stripe state as feature authority.
- Keep local Stripe routes temporarily disabled or admin-only until removed.
- Keep webhook sync only if a standalone fallback mode is explicitly required.

### Phase 6: Enforcement Cleanup

- Replace `PLAN_LIMITS` feature checks for `entraEnabled` and `emailToTicket` with OperatorOS feature flags.
- Audit every use of `org.plan`, `subscriptionStatus`, and `stripeSubscriptionId`.
- Remove or quarantine routes that can mutate local plan state independently from OperatorOS.
- Add regression tests for auth, entitlement revocation, org isolation, and paid feature gates.

## Environment Variables

Current PulseDesk env:

- `DATABASE_URL`
- `SESSION_SECRET`
- `MODULE_SSO_SECRET`
- `OPERATOROS_BASE_URL`
- `OPERATOROS_SSO_AUDIENCE` (`pulsedesk`)
- `OPERATOROS_SSO_ENV`
- `OPERATOROS_API_URL`
- `OPERATOROS_SSO_CONSUME_URL` (preferred as of Phase 1)
- `PULSEDESK_LOCAL_AUTH_ENABLED` (development/reviewer only; local register/login disabled unless set to `true`)
- Replit Stripe connector env used indirectly by `stripe-replit-sync`
- Email/OAuth envs listed in `README.md`

Target OperatorOS child-module env:

- `MODULE_SSO_SECRET`: HS256 JWT verification and entitlement webhook HMAC.
- `OPERATOROS_BASE_URL`: expected issuer and user-facing parent URL.
- `OPERATOROS_SSO_CONSUME_URL`: preferred full absolute consume endpoint. Expected production value for the currently validated OperatorOS route is `https://operatoros.net/api/modules/sso/consume`. If OperatorOS is using the versioned route for the deployment, use `https://operatoros.net/api/v1/modules/sso/consume`. Do not add a trailing path elsewhere when this is set.
- `OPERATOROS_API_URL`: legacy fallback. Supported exact full consume values are `https://operatoros.net/api/modules/sso/consume` and `https://operatoros.net/api/v1/modules/sso/consume`. If used as an API base, set it to `https://operatoros.net/api` or `https://operatoros.net/api/v1`; PulseDesk derives the consume URL without duplicating `/api` or `/v1`.
- `OPERATOROS_SSO_AUDIENCE=pulsedesk`.
- `OPERATOROS_SSO_ENV=prod|staging|dev`.
- `OPERATOROS_SERVICE_TOKEN`: server-only bearer token for introspection and webhook registration.
- `PULSEDESK_MASTER_ADMIN_EMAIL`: comma-separated OperatorOS-authenticated email list that should receive local `isSuperAdmin=true` and tenant `owner` on SSO. `john@shotgunninjas.com` is recognized by default for ecosystem ownership.
- `PULSEDESK_MASTER_ADMIN_PASSWORD`: proposed optional first-run password; must be required to differ from defaults if user creation remains supported.
- `PULSEDESK_LOCAL_AUTH_ENABLED=true`: explicitly enables local username/password register and login for development or reviewer workflows. Leave unset in production so OperatorOS SSO is the primary entry.

OperatorOS-side env from the copied docs:

- `PULSEDESK_URL`
- `STRIPE_PRICE_PULSEDESK_MONTHLY`
- `STRIPE_PRICE_ADDON_<MODULE_SLUG>` for add-on modules where applicable.
- `OPERATOROS_BOOTSTRAP_SUPER_ADMIN_EMAIL`

## Routes To Remove Or Replace Later

Do not remove these in Phase 0.

- `POST /api/billing/checkout`: replace with OperatorOS checkout or subscription management.
- `POST /api/billing/portal`: replace with OperatorOS billing portal routing.
- `GET /api/billing/plans`: replace with OperatorOS plan/module metadata.
- `GET /api/billing/status`: replace with cached/introspected OperatorOS entitlement snapshot.
- `PATCH /api/admin/orgs/:id/plan`: remove local plan mutation or make it read-only once OperatorOS controls entitlement.
- `PATCH /api/admin/users/:id/superadmin`: keep temporarily, then restrict behind email-based master-admin policy and audit.
- Local Stripe webhook routes: keep only if PulseDesk remains deployable in standalone mode; otherwise move billing authority to OperatorOS.
- Local plan-based feature gates in auth, email, connector, IMAP, settings, billing, and admin UI: replace with OperatorOS feature flags.

Routes to add:

- `POST /webhooks/operatoros/entitlements`
- Optional admin diagnostic route for the current cached OperatorOS entitlement snapshot.

Routes to keep:

- `GET /sso`
- `POST /api/auth/login`: retained for development/reviewer fallback, but disabled unless `PULSEDESK_LOCAL_AUTH_ENABLED=true`.
- `POST /api/auth/register`: retained for development/reviewer fallback, but disabled unless `PULSEDESK_LOCAL_AUTH_ENABLED=true`.
- `GET /api/public/sso-config`, unless replaced by static parent URL config.
- Existing healthcare workflow APIs, scoped by `requireOrg`.

## Testing Checklist

Baseline:

- `npm run check`
- `npm run build`
- Smoke `/api/auth/me` authenticated and unauthenticated behavior.
- Verify seeded demo org still works.
- Verify existing local auth and M365 auth flows are not changed by Phase 0.

SSO:

- Missing token returns `400 missing_token`.
- Malformed token returns `400 bad_request`.
- Wrong alg or signature returns `401 signature_invalid`.
- Wrong issuer returns `401 issuer_mismatch`.
- Wrong audience or module slug returns `401 audience_mismatch`.
- Wrong env returns `401 env_mismatch`.
- Expired or old token returns `401 expired`.
- Future `iat` returns `401 clock_skew`.
- Consume replay returns `401 consume_failed`.
- Successful launch creates a PulseDesk session and no raw JWT is stored.
- Successful consume JSON is parsed and available to the SSO route.
- `target_module_enabled=false` or an enabled-module list excluding `pulsedesk` returns `403 entitlement_disabled` before a session is created.
- `john@shotgunninjas.com` authenticated by OperatorOS becomes a local super admin and tenant owner.
- Local username/password login returns `403 local_auth_disabled` unless `PULSEDESK_LOCAL_AUTH_ENABLED=true`.

Entitlements:

- SSO with `target_module_enabled=false` does not create a working session.
- Webhook with bad signature returns `401`.
- Older `computedAt` webhook is ignored.
- Webhook disabling PulseDesk revokes or blocks the local session.
- Introspection with bad service token fails closed.
- Introspection with valid service token updates the local snapshot.

Billing and feature gates:

- M365 configuration gate follows OperatorOS feature snapshot.
- Email-to-ticket and connector polling stop when entitlement is revoked.
- Local Stripe checkout success is not treated as entitlement without OperatorOS confirmation.

Admin:

- No hardcoded admin username or password remains.
- Bootstrap is idempotent and email-keyed.
- Self-demotion remains blocked.
- Super-admin changes are audit logged.

Security:

- Secrets are never logged.
- HMAC signature comparison is constant-time.
- Cross-tenant storage access remains scoped by `orgId`.
- Revoked users cannot switch into old sessions or orgs.
