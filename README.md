# PulseDesk

**The operational heartbeat of your healthcare facility.**

PulseDesk is a multi-tenant healthcare operations coordination platform: ticketing, departments, assets, supply requests, facility requests, vendors, analytics, billing, and email-to-ticket — all role-gated and ready for HIPAA-conscious workflows.

Live: [pulsedesk.support](https://pulsedesk.support)

---

## Part of the Shotgun Ninjas Productions ecosystem

PulseDesk is one product in a connected family of operations and diagnostic tools built by [Shotgun Ninjas Productions](https://shotgunninjas.com).

| Product | Focus | When to reach for it |
|---|---|---|
| **[PulseDesk](https://pulsedesk.support)** | Healthcare operations | Coordinating a clinic, hospital, or care facility |
| **[TechDeck](https://techdeck.app)** | IT ops & automation | Scripts, runbooks, MSP tooling for technical teams |
| **[TradeFlowKit](https://tradeflowkit.com)** | Business ops & revenue | Vendor spend, contracts, throughput dashboards |
| **[TorqueShed](https://torqueshed.pro)** | Automotive diagnostics | Repair cases, parts, mechanic community |
| **[FaultlineLab](https://faultlinelab.com)** | Diagnostic challenges | Logic, troubleshooting, investigation training |
| **[Shotgun Ninja Village](https://shotgunninjavillage.com)** | Community & creator hub | Games, merch, content |
| **[Shotgun Ninjas](https://shotgunninjas.com)** | Ecosystem hub | The front door to everything above |

PulseDesk is most often paired with **TechDeck** (for the IT teams that keep healthcare facilities online) and **TradeFlowKit** (for tracking vendor and contract throughput across an organization). In-app, you will find a "Related tools" card surfacing these connections in non-intrusive places.

---

## Stack

- **Frontend:** React 18 + Vite + TypeScript + wouter + TanStack Query v5 + shadcn/ui + Tailwind
- **Backend:** Express + tsx + Drizzle ORM + PostgreSQL
- **Auth:** Local + Microsoft 365 Entra ID (per-org OAuth, multi-tenant) + Google Workspace OAuth
- **Email:** SendGrid Inbound Parse + IMAP polling + Google/Microsoft connector OAuth
- **Billing:** Stripe (per-org subscriptions, webhook-driven plan sync)
- **PWA:** installable, theme-aware, offline-capable shell

## Architecture

```
client/             React + Vite SPA
  src/
    pages/          Route components (lazy-loaded for admin pages)
    components/     Shared UI + shadcn primitives
    lib/            queryClient, auth context, permissions, helpers

server/             Express API
  routes/           Feature routes (tickets, billing, email, admin, ...)
  auth/             Argon2id-style password hashing + Entra OAuth + crypto
  email/            Inbound parsers + IMAP poller + processor pipeline
  storage.ts        Single source of truth for all DB access (IStorage)
  db.ts             Drizzle client + Neon connection

shared/             Code shared between client + server
  schema.ts         Drizzle tables + Zod insert schemas + types
  billingConfig.ts  Plan definitions and feature gates
  permissions.ts    Role helpers
```

Every request flows through `requireAuth → requireOrg → requireMinRole(?)` middleware. All data access goes through `storage` (an `IStorage` implementation), never direct table queries from routes. This keeps multi-tenant scoping in one auditable place.

## Develop

```bash
npm install
npm run dev          # starts Express + Vite on :5000
npm run build        # client + server production bundles
node scripts/check-bundle-size.mjs   # post-build size guard
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | yes | Session signing + Entra secret encryption |
| `STRIPE_SECRET_KEY` | yes (for billing) | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | yes (for billing) | Webhook signature verification |
| `SENDGRID_API_KEY` | optional | For Inbound Parse provider |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Default Google OAuth client (most orgs use per-org credentials instead) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | optional | Default Microsoft OAuth client (most orgs use per-org credentials instead) |

OAuth credentials are stored **per-org** in `org_email_connectors` and `org_auth_config`. The env-level Google/Microsoft secrets only act as fallbacks for development convenience. New customers should configure their own OAuth apps in Settings → Authentication or Connected Inboxes.

## Deployment

- Replit Deployments (autoscale or reserved VM). Build runs `npm run build`,
  start runs `npm run start` (esbuild server bundle in `dist/index.cjs`).
- Stripe webhook endpoint: `POST /api/billing/webhook` (raw body, signature
  verified).
- SendGrid Inbound Parse: `POST /api/email/inbound/sendgrid` (alias routes
  to org).
- Health: `GET /api/health`.

## Project conventions

- Multi-tenant by design — every API route is org-scoped via `requireOrg`.
- OAuth credentials are stored **per-org**; no global secret required for production.
- Stripe plans drive feature gates via `shared/billingConfig.ts`.
- All interactive elements carry `data-testid` for stable test selectors.
- Admin-only pages are lazy-loaded via `React.lazy` to keep the main bundle small.
- Use `apiRequest` from `@/lib/queryClient` for mutations; cache invalidation by `queryKey` array segments.
- Backend reads/writes always go through `storage` (`IStorage`); never query Drizzle from a route directly.

## Security

A lightweight STRIDE-based threat model lives in [`threat_model.md`](./threat_model.md). It covers assets, trust boundaries, mitigations, and known follow-ups. Run scans with the Replit security tooling (`runDependencyAudit`, `runSastScan`, `runHoundDogScan`) before any release.

## Contact & support

- Product support: support@pulsedesk.support
- Ecosystem: [shotgunninjas.com](https://shotgunninjas.com)
