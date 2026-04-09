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
- Settings for profile, organization, team member management
- PD-XXXXX auto-generated ticket numbering

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
- `shared/schema.ts` - Drizzle schema, Zod insert schemas, type exports, label constants

### Server
- `server/index.ts` - Express app entry point
- `server/routes/index.ts` - Route registration with session middleware
- `server/routes/auth.ts` - Auth (login, register, logout, profile, password change, members list, M365 SSO, auth config, role mappings, audit log)
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
- `server/routes/admin.ts` - Super admin endpoints
- `server/storage.ts` - Storage layer with all CRUD methods
- `server/seed.ts` - Demo data seeding (Metro Health Network)
- `server/middleware.ts` - Auth middleware (requireAuth, requireOrg, requireSuperAdmin)

### Frontend
- `client/src/App.tsx` - Main app with routing
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/lib/permissions.ts` - Role-based permission utilities
- `client/src/lib/queryClient.ts` - TanStack Query client
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with role-based visibility
- `client/src/components/page-header.tsx` - Reusable page header
- `client/src/components/status-badge.tsx` - Unified StatusBadge component
- `client/src/pages/` - All page components (dashboard, tickets, ticket-detail, submit-issue, departments, assets, supply-requests, facility-requests, vendors, analytics, settings, admin, auth-page, org-setup)

## Demo Credentials
- **Demo user**: username=demo, password=demo123 (admin of Metro Health Network)
- **Technician**: username=jmorales, password=demo123
- **Staff**: username=knguyen, password=demo123
- **Reviewer**: username=reviewer, password=Reviewer2026!
- **Super admin**: username=Johntwms355, password=Admin2026!

## Phase 3 Additions

### API-Level Role Enforcement
- `requireRole(...roles)` middleware: Checks membership role against exact list (e.g., `requireRole("admin")`)
- `requireMinRole(role)` middleware: Checks membership role against hierarchy threshold (e.g., `requireMinRole("technician")`)
- Applied across all CRUD routes: ticket create (staff+), ticket update (technician+), ticket delete (supervisor+), department/asset/vendor write operations (supervisor+ or admin), analytics (supervisor+), org settings (admin), membership management (admin)

### Session & Auth Hardening
- Session expiration detection via `pulsedesk:session-expired` custom event
- 401 responses from API automatically trigger toast + redirect to login
- `sessionExpired` state in AuthContext for UI awareness
- JSON error responses from all API routes (not plain text)

### Frontend Protection
- `ErrorBoundary` component wraps the entire app and the main content area
- `RoleGate` component enforces role-based route access (renders Unauthorized page for insufficient permissions)
- `Unauthorized` page component for 403 states
- Improved `NotFound` page with PulseDesk branding

### Demo Mode
- `VITE_DEMO_MODE=true` environment flag enables demo banner
- `DemoBanner` component shows subtle amber notification bar

### Notification Center
- `NotificationCenter` dropdown with placeholder notifications (assignment, overdue, escalation, resolution, supply)
- Integrated in sidebar header (desktop) and top bar (mobile)
- "Preview" badge indicates feature is in foundation stage

### Export/Print Readiness
- Export placeholder button on analytics page
- Print buttons on analytics and ticket detail pages
- Print CSS media query already configured in index.css

### Settings Enhancements
- Preferences tab with notification settings placeholder and account info display
- Operational settings section (timezone, business hours, SLA placeholder) for admins
- Organization tab gated to admin role only
- Team tab gated to admin role only
- Supervisor invite code generation added
- Better form validation with inline error messages

### Form Hardening
- Submit issue form with client-side validation (title length, patient-impact description requirement)
- Inline `FieldError` component with destructive styling
- Helper text on form fields for guidance
- Note content validation on ticket detail

## Microsoft 365 / Entra ID Authentication

### Architecture
- **Provider abstraction**: `AuthProvider` interface with `LocalAuthProvider` and `EntraAuthProvider` implementations
- **Auth modes per org**: `local` (passwords only), `m365` (Microsoft SSO only), `hybrid` (both, with local fallback for admins)
- **Tenant-aware login**: Login page resolves org by slug, shows appropriate sign-in options
- **OIDC authorization code flow**: Entra provider constructs OIDC authorize URL with state/nonce, handles callback token exchange + userinfo via Microsoft Graph

### Role Mapping
- Maps Entra ID security group Object IDs to PulseDesk roles
- Highest-level matching role wins when user belongs to multiple groups
- `entraGroupId` is the stable UUID from Azure AD (not display name)
- `displayLabel` is optional human-readable label for admin UI
- Unmapped users default to `staff` role

### JIT Provisioning
- Creates user + org membership on first M365 login when enabled
- Generates username from UPN prefix (e.g., `john.doe@org.com` → `john.doe`)
- Refreshes profile (name, email, department, job title) on subsequent logins
- Updates role mapping on each login if group memberships change

### Security
- Client secrets encrypted at rest with AES-256-GCM (key derived from SESSION_SECRET via scrypt)
- Stored as `iv:tag:ciphertext` hex format in `org_auth_config.entra_client_secret_encrypted`
- State parameter validated on callback to prevent CSRF
- Session stores `authSource` to distinguish local vs M365 users

### Database Tables
- `org_auth_config`: Per-org auth configuration (mode, Entra tenant/client IDs, encrypted secret, JIT toggle, test status, Graph placeholders)
- `org_role_mappings`: Entra group ID → PulseDesk role mappings with optional display labels
- `auth_audit_log`: Login events, config changes, JIT provisioning events with IP/user-agent tracking
- Extended `users`: `auth_source`, `entra_object_id`, `entra_upn`, `entra_department`, `entra_job_title`, `entra_manager_id`, `graph_last_synced_at`, `last_login_at`

### API Endpoints
- `GET /api/auth/tenant/:slug` - Public: resolve org auth mode for login page
- `GET /api/auth/m365/login?org=<slug>` - Initiate M365 OIDC flow
- `GET /api/auth/m365/callback` - Handle OIDC callback + JIT provisioning
- `GET /api/auth/config` - Admin: get org auth configuration
- `PUT /api/auth/config` - Admin: update org auth configuration
- `POST /api/auth/config/test` - Admin: test Entra connection (OIDC discovery check)
- `GET /api/auth/role-mappings` - Admin: list role mappings
- `POST /api/auth/role-mappings` - Admin: create role mapping
- `DELETE /api/auth/role-mappings/:id` - Admin: delete role mapping
- `GET /api/auth/audit-log` - Admin: view auth events

### Admin UI (Settings → Auth tab)
- Auth mode selector (local/hybrid/m365)
- Entra configuration form (tenant ID, client ID, client secret, redirect URI)
- JIT provisioning toggle
- Connection test button with status display
- Group-to-role mapping editor (add/remove mappings with group Object ID + display label)
- Graph integration placeholder section
- Auth audit log viewer

## Key Design Decisions
- No Stripe, subscriptions, or Twilio/SMS features
- Roles: owner, admin, supervisor, staff, technician, readonly
- Ticket numbering: PD-XXXXX (auto-incrementing counter per org)
- Organization creation auto-seeds 10 default departments
- Healthcare-appropriate blue/teal color scheme
- StatusBadge used across all pages for consistent badge rendering
- Role-based UI visibility enforced in sidebar, action buttons, page elements, AND API routes
- Dashboard enhanced with aging buckets, triage/resolution performance metrics, patient impact indicators
- API routes return JSON error objects (`{ error: "message" }`) instead of plain text
- PulseLoader used consistently across all pages as the branded loading indicator (no Skeleton loading states)
- Department/vendor create gated to supervisor+ (matches API requireMinRole("supervisor"))
- Department/vendor delete gated to admin only (matches API requireMinRole("admin"))
- All PWA/manifest/service-worker references use PulseDesk branding (no TradeFlowKit remnants)
