# PulseDesk - Healthcare Operations Ticketing System

## Overview
PulseDesk is a multi-tenant healthcare operations ticketing system designed for hospitals and medical facilities. It centralizes the management of IT/facilities tickets, medical equipment tracking, supply requests, facility work orders, vendor management, and department-level operations through a web-based portal. The system aims to be the "digital front desk for internal healthcare ops," focusing on efficiency and organization within healthcare administration.

**Key Capabilities:**
- Comprehensive ticket management with various statuses and priority levels.
- Asset and supply request tracking.
- Vendor and department management.
- Operational dashboards and analytics.
- Role-based access control and multi-tenancy.
- Secure authentication including Microsoft 365 / Entra ID SSO.
- PWA support for enhanced user experience.

## User Preferences
Not specified.

## System Architecture

PulseDesk employs a monolithic full-stack architecture.

**Frontend:**
- **Technology:** React with Vite.
- **State Management & Data Fetching:** TanStack Query.
- **Routing:** Wouter.
- **UI Components:** shadcn/ui.
- **Styling:** Tailwind CSS.
- **Branding Elements:** `PulseLine` (SVG pulse/ECG waveform), `PulseLoader` (branded loading animation), `PulseDivider`.
- **Color Scheme:** Primary navy blue (hsl(213 65% 33%)), accent teal (hsl(177 56% 42%)), clinical background (hsl(216 60% 97%)).
- **PWA Features:** Manifest, service worker for caching, iOS meta tags, and a smart `PwaInstallPrompt` component.
- **Reusable Components:** `StatusBadge` for consistent status display, `PageHeader`, and `AppSidebar` with role-based navigation.
- **Permissions:** 6-tier role hierarchy (owner, admin, supervisor, technician, staff, readonly) managed via `client/src/lib/permissions.ts` and enforced on UI elements.

**Backend:**
- **Technology:** Express.js.
- **Authentication:** Session-based (connect-pg-simple) with support for local and OIDC providers (Microsoft Entra ID). AES-256-GCM encryption for sensitive credentials.
- **Core Modules:** Organized by domain (auth, onboarding, billing, tickets, departments, assets, supply requests, facility requests, vendors, analytics, admin, email).
- **Middleware:** `requireAuth`, `requireOrg`, `requireSuperAdmin`, `requireRole`, `requireMinRole`, `requireFeature` for robust access control and plan-gating.
- **Storage Layer:** Centralized CRUD operations in `server/storage.ts`.

**Database:**
- **Type:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Schema:** Defined in `shared/schema.ts`, including Drizzle schema, Zod validation, and type exports.
- **Migrations:** Managed through `server/migrate.ts`.
- **Onboarding System:** Database-backed `onboarding_items` table with auto-completion logic for initial setup tasks.

**Design Decisions:**
- **User Roles:** Owner, admin, supervisor, staff, technician, readonly.
- **Ticket Numbering:** Auto-generated `PD-XXXXX` format per organization.
- **Default Data:** 10 default departments auto-seeded on organization creation.
- **Consistent UI/UX:** Use of `StatusBadge` and `PulseLoader` across the application.
- **API Error Handling:** JSON error objects (`{ error: "message" }`) for predictable error responses.
- **Cross-Tenant Isolation:** Delete endpoints return 404 for non-existent records, reinforcing data isolation.

## External Dependencies

- **PostgreSQL:** Primary database.
- **Stripe:** For billing, subscriptions, and plan management. Integrated via `stripe-replit-sync` for webhook synchronization.
- **Microsoft Entra ID / Microsoft 365:** For Single Sign-On (SSO) authentication.
- **IMAP (via imapflow & mailparser):** For the Email-to-Ticket system, enabling polling of mailboxes and parsing inbound emails.
- **Google/Microsoft OAuth 2.0:** For Mail Connectors system, allowing secure integration with Gmail and Outlook.

## Connected Inboxes (Mail Connectors)
The "Connected Inboxes" page (`/email-settings`) replaces the old "Email-to-Ticket" settings. It provides:
- Google Workspace OAuth connector card with connect/disconnect/sync/test controls
- Microsoft 365 OAuth connector card with similar controls
- Email Forwarding connector with copy-to-clipboard address and per-provider setup instructions
- Advanced IMAP section (expandable, marked as legacy fallback) for generic IMAP connectors
- Per-connector health status indicators (green/yellow/red dot, status badges)
- Token recovery UX (re-authorize prompt for expired/revoked OAuth tokens)
- Processing rules (enable/disable, auto-contacts, thread replies)
- Routing defaults (department, assignee, unknown sender behavior)
- Sender domain allowlists
- Test inbound email simulator
- Recent processing log (inbound email event history)
- Plan-gated: locked premium card for non-Enterprise/Unlimited plans

**Super Admin Dashboard** (`/admin`): The Mail Connector Dashboard replaces the old IMAP Polling Dashboard with:
- All connectors across all tenants with provider, status, org info, emails processed
- Filter/search by provider type and status
- Per-connector actions: disable, enable, force-poll, view events
- Legacy IMAP pollers section (preserved for backward compatibility)

**Sidebar:** Renamed from "Email-to-Ticket" to "Connected Inboxes" with Inbox icon.
**OAuth callback:** Redirects to `/email-settings?connectorSuccess=true` or `?connectorError=...`.