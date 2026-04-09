# PulseDesk - Healthcare Operations Ticketing System

## Overview

PulseDesk is a multi-tenant healthcare operations ticketing system for hospitals and medical facilities. It provides a web-based portal for managing IT/facilities tickets, medical equipment tracking, supply requests, facility work orders, vendor management, and department-level operations.

The application follows a monolithic full-stack architecture with a React frontend served by an Express backend, backed by PostgreSQL via Drizzle ORM. It supports multi-tenancy through organizations with role-based memberships (admin, supervisor, staff, technician, readonly).

**Core features:**
- Authentication (username/password with session-based auth)
- Organization creation and invite-code-based joining
- Ticket management with 9 statuses (new, triage, assigned, waiting_department, waiting_vendor, in_progress, escalated, resolved, closed)
- 4 priority levels (critical, high, normal, low)
- 10 ticket categories (medical equipment, IT infrastructure, facilities/building, housekeeping, safety/compliance, patient room, vendor/external, administrative, clinical systems, other)
- Department management (10 default departments auto-seeded on org creation)
- Equipment/asset tracking with status (active, under_service, retired, offline)
- Supply request workflow (pending → approved → ordered → fulfilled / denied)
- Facility request management (HVAC, plumbing, lighting, electrical, etc.)
- Vendor directory with emergency contacts
- Dashboard with operational KPIs
- Analytics page with ticket volume, category breakdown, department distribution
- Settings for profile, organization, team member management
- PD-XXXXX auto-generated ticket numbering

## Architecture

- **Frontend**: React with Vite, TanStack Query, wouter routing, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js with session-based auth (connect-pg-simple)
- **Database**: PostgreSQL with Drizzle ORM
- **Color scheme**: Primary navy blue hsl(213 64% 33%), accent teal hsl(174 55% 40%), light blue-gray background hsl(210 33% 98%)

## File Structure

### Shared
- `shared/schema.ts` - Drizzle schema, Zod insert schemas, type exports, label constants

### Server
- `server/index.ts` - Express app entry point
- `server/routes/index.ts` - Route registration with session middleware
- `server/routes/auth.ts` - Auth (login, register, logout, profile, password change, members list)
- `server/routes/orgs.ts` - Organization CRUD, invite codes, memberships
- `server/routes/tickets.ts` - Ticket CRUD, dashboard stats, ticket events/notes
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
- `client/src/lib/queryClient.ts` - TanStack Query client
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/components/page-header.tsx` - Reusable page header
- `client/src/pages/` - All page components (dashboard, tickets, ticket-detail, submit-issue, departments, assets, supply-requests, facility-requests, vendors, analytics, settings, admin, auth-page, org-setup)

## Demo Credentials
- **Demo user**: username=demo, password=demo123 (admin of Metro Health Network)
- **Technician**: username=jmorales, password=demo123
- **Staff**: username=knguyen, password=demo123
- **Reviewer**: username=reviewer, password=Reviewer2026!
- **Super admin**: username=Johntwms355, password=Admin2026!

## Key Design Decisions
- No Stripe, subscriptions, or Twilio/SMS features
- Roles: admin, supervisor, staff, technician, readonly (no owner/tech/viewer)
- Ticket numbering: PD-XXXXX (auto-incrementing counter per org)
- Organization creation auto-seeds 10 default departments
- Healthcare-appropriate blue/teal color scheme
