# PulseDesk - Healthcare Operations Ticketing System

## Overview

PulseDesk is a multi-tenant healthcare operations ticketing system for hospitals and medical facilities. It provides a web-based portal for managing IT/facilities tickets, medical equipment tracking, supply requests, facility work orders, vendor management, and department-level operations.

The application follows a monolithic full-stack architecture with a React frontend served by an Express backend, backed by PostgreSQL via Drizzle ORM. It supports multi-tenancy through organizations with role-based memberships (admin, supervisor, staff, technician, readonly).

**Core features:**
- Authentication (local username/password + Microsoft 365 / Entra ID SSO with tenant-aware login)
- Organization creation and invite-code-based joining
- Ticket management with 9 statuses (new, triage, assigned, waiting_department, waiting_vendor, in_progress, escalated, resolved, closed)
- 4 priority levels (critical, high, normal, low)
- 10 ticket categories (medical equipment, IT infrastructure, facilities/building, housekeeping, safety/compliance, patient room, vendor/external, administrative, clinical systems, other)
- Department management (10 default departments auto-seeded on org creation)
- Equipment/asset tracking with status (active, under_service, retired, offline)
- Supply request workflow (pending → approved → ordered → fulfilled / denied)
- Facility request management (HVAC, plumbing, lighting, electrical, etc.)
- Vendor directory with emergency contacts
- Dashboard with operational KPIs, aging buckets, performance metrics
- Analytics page with ticket volume, category breakdown, department distribution
- Settings for profile, organization, team member management, billing
- PD-XXXXX auto-generated ticket numbering
- Database-backed onboarding system with auto-completion

## Architecture

- **Frontend**: React with Vite, TanStack Query, wouter routing, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js with session-based auth (connect-pg-simple)
- **Database**: PostgreSQL with Drizzle ORM
- **Color scheme**: Primary navy blue hsl(213 65% 33%), accent teal hsl(177 56% 42%), clinical background hsl(216 60% 97%)

## Design System

### Brand
- PulseDesk: "digital front desk for internal healthcare ops" — NOT generic IT, NOT startup, NOT patient-facing
- HeartPulse icon as logo element
- Calm, authoritative, healthcare-admin appropriate vocabulary

### CSS Variables (index.css)
- `--primary`: 213 65% 33% (navy blue)
- `--accent`: 177 56% 42% (teal)
- `--background`: 216 60% 97% (clinical white-blue)
- `--sidebar`: 213 64% 16% (dark navy)
- `--sidebar-primary`: 177 56% 42% (teal accent in sidebar)
- `--success`: 146 50% 36%
- `--warning`: 43 100% 44%

### Brand Expression Components
- `PulseLine` (`client/src/components/pulse-line.tsx`): SVG pulse/ECG waveform component with variants (full, minimal, divider). Used as decorative motifs.
- `PulseLoader` (`client/src/components/pulse-line.tsx`): Branded loading state with animated pulse waveform and "Loading..." text. Includes `role="status"` and `aria-live="polite"` for accessibility.
- `PulseDivider` (`client/src/components/pulse-line.tsx`): Decorative pulse-line section divider with gradient lines.
- CSS animations: `pulse-line-draw` (SVG draw-on), `pulse-glow` (opacity cycle), `pulse-dot-critical` (pulsing alert dot). All respect `prefers-reduced-motion`.

### PWA
- Manifest: `client/public/manifest.json` (display: standalone, theme: #1f3044)
- Service worker: `client/public/sw.js` (cache-first static assets, network-first navigation/API)
- SW registered in `client/src/main.tsx` (production only via `import.meta.env.PROD`)
- iOS meta tags in `client/index.html` (apple-touch-icon, apple-mobile-web-app-capable)
- `PwaInstallPrompt` component (`client/src/components/pwa-install-prompt.tsx`): Smart install banner that uses `beforeinstallprompt` on Chromium and shows Share→Add to Home Screen instructions on iOS Safari. Auto-hides when app is in standalone mode or after user dismisses (72h cooldown in localStorage).

### Components
- `StatusBadge` (`client/src/components/status-badge.tsx`): Unified badge component for ticket-status, ticket-priority, asset-status, supply-status, facility-status, facility-priority. Sizes: xs, sm, md.
- `PageHeader` (`client/src/components/page-header.tsx`): Standard page header with sidebar trigger, title, description, action/actions slots.
- `AppSidebar` (`client/src/components/app-sidebar.tsx`): Dark navy sidebar with teal pulse-line divider, role-based nav visibility, org switcher, user footer with role label.

### Permissions
- `client/src/lib/permissions.ts`: Role-based permission utilities
- 6-tier hierarchy: owner (120) > admin (100) > supervisor (80) > technician (60) > staff (40) > readonly (10)
- Functions: canManageTickets, canAssignTickets, canManageSettings, canSubmitIssues, canAddNotes, canEscalate, canViewAnalytics, canManageUsers, isReadOnly
- `ROLE_LABELS`: owner→Owner, admin→Administrator, supervisor→Supervisor, technician→Technician, staff→Staff, readonly→Executive (Read-Only)

### Status Vocabulary
- "Intake" (new), "Triage" (triage), "Assigned" (assigned), "Dept. Pending" (waiting_department), "Vendor Pending" (waiting_vendor), "In Progress" (in_progress), "Escalated" (escalated), "Resolved" (resolved), "Closed" (closed)
- "Report Issue" (not "Submit Issue"), "Queue" (not "back to tickets")

## File Structure

### Shared
- `shared/schema.ts` - Drizzle schema, Zod insert schemas, type exports, label constants, onboarding defaults

### Server
- `server/index.ts` - Express app entry point with startup logging (DB, migration, session verification)
- `server/routes/index.ts` - Route registration with session middleware (explicit table name, error logging)
- `server/routes/auth.ts` - Auth (login, register, logout, profile, password change, members list, M365 SSO, auth config, role mappings, audit log)
- `server/routes/onboarding.ts` - Onboarding items CRUD, auto-completion, reorder
- `server/routes/billing.ts` - Billing status with Stripe sync status, checkout, portal, plans
- `server/auth/index.ts` - Auth provider registry and re-exports
- `server/auth/providers.ts` - AuthProvider interface, AuthProviderConfig, result types
- `server/auth/local-provider.ts` - Local (bcrypt) authentication provider
- `server/auth/entra-provider.ts` - Microsoft Entra ID / OIDC authorization code flow provider
- `server/auth/crypto.ts` - AES-256-GCM encryption for client secrets (key derived from SESSION_SECRET via scrypt)
- `server/auth/graph-service.ts` - IGraphService interface placeholder for future Microsoft Graph integration
- `server/routes/orgs.ts` - Organization CRUD, invite codes, memberships
- `server/routes/tickets.ts` - Ticket CRUD, dashboard stats (enhanced with aging/triage/resolution metrics), ticket events/notes
- `server/routes/departments.ts` - Department CRUD
- `server/routes/assets.ts` - Equipment/asset CRUD
- `server/routes/supplyRequests.ts` - Supply request CRUD
- `server/routes/facilityRequests.ts` - Facility request CRUD
- `server/routes/vendors.ts` - Vendor CRUD
- `server/routes/analytics.ts` - Analytics data aggregation
- `server/routes/admin.ts` - Super admin endpoints (org listing/deletion, plan management, user listing with memberships, role changes across tenants, super admin grant/revoke)
- `server/storage.ts` - Storage layer with all CRUD methods including onboarding
- `server/seed.ts` - Demo data seeding (Metro Health Network)
- `server/middleware.ts` - Auth middleware (requireAuth, requireOrg, requireSuperAdmin, requireRole, requireMinRole, requireFeature). Owner role bypasses requireRole checks. requireFeature checks PLAN_LIMITS for plan-gated features.
- `server/routes/email.ts` - Email-to-Ticket routes (settings CRUD, inbound webhook, test, events, contacts, IMAP config/test/status/reset, super admin CRUD + IMAP dashboard)
- `server/services/emailProcessor.ts` - Inbound email processing service (provider adapters, threading, contact upsert, alias resolution)
- `server/services/imapClient.ts` - IMAP client (connect, fetch unseen, parse to ParsedEmail, mark seen, test connection) using imapflow + mailparser
- `server/services/imapPoller.ts` - Per-tenant IMAP polling orchestrator (independent loops, plan gating, exponential backoff, auto-disable after 5 failures)
- `server/migrate.ts` - Schema migration with enum fixes (membership_role + org_plan), stale role migration, column default updates, session table + onboarding_items table

### Frontend
- `client/src/App.tsx` - Main app with routing
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/lib/permissions.ts` - Role-based permission utilities
- `client/src/lib/queryClient.ts` - TanStack Query client
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with role-based visibility
- `client/src/components/page-header.tsx` - Reusable page header
- `client/src/components/status-badge.tsx` - Unified StatusBadge component
- `client/src/pages/` - All page components (dashboard, tickets, ticket-detail, submit-issue, departments, assets, supply-requests, facility-requests, vendors, analytics, settings, billing, email-settings, admin, auth-page, org-setup)

## Demo Credentials
- **Demo user**: username=demo, password=demo123 (admin of Metro Health Network)
- **Technician**: username=jmorales, password=demo123
- **Staff**: username=knguyen, password=demo123
- **Reviewer**: username=reviewer, password=Reviewer2026!
- **Super admin**: username=Johntwms355, password=Admin2026!

## Session & Auth System
- Session store: `connect-pg-simple` with explicit `tableName: "session"` and `errorLog` handler
- Session table explicitly created in `server/migrate.ts` (not relying on auto-create)
- Cookie: maxAge=30d, httpOnly=true, secure=production-only, sameSite=lax
- Trust proxy: `app.set("trust proxy", 1)` for Replit reverse proxy
- Session save errors logged with stack trace via `[session.save error]` prefix
- Login success logs session ID for debugging
- Startup sequence: DB connect → migrations → seed → session table verify → Stripe sync → routes register

## Database-Backed Onboarding System
- **Table**: `onboarding_items` with fields: id, org_id, title, description, route, sort_order, status (pending/in_progress/complete/skipped), completion_source (manual/auto), completed_by, completed_at, dismissed_at, auto_complete_key, created_at, updated_at
- **Auto-completion rules**: assets (count>0), vendors (count>0), members (count>1), tickets (count>0). Departments excluded from auto-completion since default departments are pre-seeded on org creation.
- **Default items**: 5 starter tasks seeded per org on first access
- **API**: GET/POST /api/onboarding, PATCH /api/onboarding/:id, POST /api/onboarding/:id/complete, POST /api/onboarding/:id/skip, POST /api/onboarding/reorder
- **Dashboard UI**: Progress bar, auto/manual completion badges, skip/complete hover actions, click-through navigation
- **Cache invalidation**: `/api/onboarding` invalidated alongside `/api/dashboard` on all CRUD mutations

## Stripe Billing & Subscriptions
- **Stripe integration** via Replit connector (`stripe-replit-sync` for webhook sync + schema management)
- **Products**: Pro ($60/mo), Pro Plus ($80/mo), Enterprise ($100/mo), Unlimited ($200/mo) — seeded via `server/seed-products.ts`
- **Plan limits**: Free (5 users, local login only), Pro (50 users, 365/Entra), Pro Plus (100 users, 365/Entra), Enterprise (200 users, all features), Unlimited (unlimited users, all features)
- **Feature gating**: Member limit enforced on join; Entra/365 login gated by plan (Free = local only, Pro+ = Entra enabled); auth config update blocked server-side for Free plan
- **Dedicated Billing Page** (`/billing`): Full plan comparison with feature lists, usage bars, upgrade CTAs, success banner, billing portal access. Admin-only via `canManageSettings` route gate.
- **Sidebar Billing nav**: CreditCard icon in System group, visible only to admins/owners
- **Dashboard Upsell Card**: Shows on free-plan orgs for all users. Admins get "View Plans & Upgrade" CTA; non-admins see "ask your admin" message.
- **Checkout flow**: Stripe Checkout with success/cancel redirects to `/billing?billing=success|cancelled`. Success triggers confetti-style banner + cache refresh.
- **Paid plan management**: "Manage Billing" button, "Open Billing Portal" link, "Change Plan" option — all launch Stripe portal
- **Billing status API**: Returns plan, subscription status (active/trialing/etc), stripeSyncStatus (connected/unavailable), usage bars, limits
- **Webhook**: Registered at `/api/stripe/webhook` BEFORE `express.json()` middleware in `server/index.ts`
- **Subscription sync**: `syncOrgPlanFromStripe()` in billing route checks `stripe.subscriptions` and updates org plan on each status check
- **Stripe API fallback**: All billing endpoints (`/api/billing/plans`, `getApprovedPriceIds`, `syncOrgPlanFromStripe`) first query `stripe.*` DB tables; if empty, fall back to querying the Stripe API directly. This ensures billing works even when `stripe-replit-sync` backfill hasn't populated the DB tables.
- **Files**: `server/stripeClient.ts`, `server/webhookHandlers.ts`, `server/routes/billing.ts`, `server/seed-products.ts`, `client/src/pages/billing.tsx`

## Email-to-Ticket System
- **Plan gating**: Enterprise and Unlimited plans only (via `PLAN_LIMITS.emailToTicket` + `requireFeature` middleware)
- **Schema tables**: `email_settings`, `email_contacts`, `inbound_email_log`, `ticket_email_metadata` in `shared/schema.ts`
- **Ticket source**: `ticketSourceEnum` (manual, email, api) + `source` column on tickets table
- **Alias format**: `support+{slug}@pulsedesk.support` generated by `generateAlias(slug)` in `server/services/emailProcessor.ts`
- **Threading**: Message-ID/In-Reply-To/References headers + `[PD-XXXXX]` token in subject line
- **Provider adapter**: `InboundEmailProvider` interface with `MockEmailProvider` default; extensible via `registerProvider()`
- **Unknown sender**: Configurable per org — `create_ticket` (default) or `reject`
- **Body processing**: Strips email signatures, `>` quoted lines, `On ... wrote:` headers
- **Routes**: `server/routes/email.ts` — GET/PATCH settings, POST initialize, POST test-inbound, GET events/contacts, POST inbound webhook, IMAP config/test/status/reset, super admin CRUD
- **Frontend**: `client/src/pages/email-settings.tsx` — locked card for lower tiers, activation flow, settings controls, test tool, IMAP mailbox config, event log
- **Sidebar**: Mail icon in System group, admin-only visibility
- **Rate limiting**: In-memory rate limiter on inbound webhook (30 req/min per IP)
- **IMAP Polling**: Per-tenant mailbox polling via `imapflow` + `mailparser` packages
  - **Service files**: `server/services/imapClient.ts` (connection, fetch unseen, parse), `server/services/imapPoller.ts` (orchestrator with independent per-tenant loops)
  - **Schema columns**: `imap_host`, `imap_port`, `imap_user`, `imap_password_encrypted`, `imap_tls`, `imap_enabled`, `imap_last_polled_at`, `imap_last_error`, `imap_poll_interval_seconds`, `imap_consecutive_failures` on `email_settings` table
  - **Credential encryption**: IMAP passwords encrypted with AES-256-GCM via `encryptSecret`/`decryptSecret` in `server/auth/crypto.ts`
  - **Backoff**: Exponential backoff on failures (30s base, max 10min), auto-disable after 5 consecutive failures
  - **Auto-start**: Pollers start on server boot for all eligible tenants (Enterprise/Unlimited plan, IMAP enabled + configured)
  - **API**: GET `/api/email/imap/status`, POST `/api/email/imap/configure`, PATCH `/api/email/imap`, POST `/api/email/imap/test`, POST `/api/email/imap/reset`
  - **Super admin**: GET `/api/admin/imap/status` (dashboard), POST `/api/admin/imap/reset/:orgId`
  - **Frontend**: IMAP Mailbox Polling card in email-settings with connection form, test button, polling status, enable/disable toggle, error display, reset button
  - **Admin dashboard**: IMAP Polling Dashboard card in admin.tsx with per-tenant status, error display, reset controls

## Key Design Decisions
- Roles: owner, admin, supervisor, staff, technician, readonly (DB enum also contains legacy `tech`/`viewer` values — unused, harmless, cannot be removed without type recreation)
- org_plan: free, pro, pro_plus, enterprise, unlimited (DB enum also contains legacy `individual`/`small_business` values — unused)
- Ticket numbering: PD-XXXXX (auto-incrementing counter per org)
- Organization creation auto-seeds 10 default departments
- Healthcare-appropriate blue/teal color scheme
- StatusBadge used across all pages for consistent badge rendering
- Role-based UI visibility enforced in sidebar, action buttons, page elements, AND API routes
- Dashboard enhanced with aging buckets, triage/resolution performance metrics, patient impact indicators
- API routes return JSON error objects (`{ error: "message" }`) instead of plain text
- Delete endpoints return 404 when no matching record found (prevents silent no-ops and ensures cross-tenant isolation is observable)
- PulseLoader used consistently across all pages as the branded loading indicator (no Skeleton loading states)
- Department/vendor create gated to supervisor+ (matches API requireMinRole("supervisor"))
- Department/vendor delete gated to admin only (matches API requireMinRole("admin"))
- All PWA/manifest/service-worker references use PulseDesk branding
