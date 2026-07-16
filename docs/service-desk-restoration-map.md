# PulseDesk Service Desk Restoration Map

Generated: 2026-07-15

## Recovery findings

PulseDesk was not reduced to a blank codebase. The `main` branch still contains the original healthcare operations application and the later OperatorOS SSO/entitlement work. The deployed one-page behavior is consistent with a launch-path mismatch: authenticated application routes exist at `/` and `/dashboard`, while OperatorOS can launch the module at `/app` and the SPA did not register that path.

Git history also contains a removed customer-management implementation (immediately before commit `45429e9`). Its tenant-scoped list/profile/API patterns are reusable, but its field-service jobs, quotes, invoices, local subscription limits, and standalone billing assumptions are not valid PulseDesk product boundaries and will not be restored.

## Existing production-capable foundation

| Capability | Evidence | Restoration action |
|---|---|---|
| OperatorOS SSO and one-time-token consumption | `server/routes/sso.ts`, `server/auth/operatoros-sso.ts` | Preserve; redirect to canonical `/app`; retain entitlement denial and expiry handling. |
| OperatorOS tenant and entitlement snapshots | `operatoros_entitlement_snapshots`, `server/services/operatorosEntitlements.ts` | Preserve as identity/access source of truth. |
| Tenant-scoped tickets and events | `tickets`, `ticket_events`, `server/routes/tickets.ts`, `server/storage.ts` | Extend rather than replace. |
| Departments, assets, vendors | Existing schema, API routes, and pages | Extend to clients/sites/devices/contracts and related-ticket views. |
| Notifications and audit | `notifications`, `auth_audit_log` | Preserve; add service-desk activity events and notification preferences. |
| Email-to-ticket | Email settings, connectors, inbound logs, ticket metadata | Preserve; map email contacts to first-class client contacts where possible. |
| Healthcare operations dashboard | `client/src/pages/dashboard.tsx` | Keep healthcare context while adding service-desk work queues and quick create. |

## Domain restoration sequence

### Foundation — execute first

- Add tenant-scoped clients, sites, contacts, queues, teams, assignments, SLA policies/events, time entries, asset devices, contracts, KB, attachments, tags, saved views, notification preferences, and service activity events.
- Add configurable ticket status, priority, type, and category records without breaking legacy ticket enum values.
- Extend tickets with client/contact/site/queue/SLA/type links plus resolution, close, reopen, and archive timestamps.
- Extend assets with client/site ownership, serial number, assigned user, warranty dates, notes, and updated timestamps.
- Add tenant-qualified unique indexes for ticket numbers, client/site/contact keys, asset tags, queue names, and article slugs.
- Add idempotent runtime migration coverage because this repo currently provisions schema from `server/migrate.ts` at startup.

### Service APIs and security

- Add CRUD APIs for clients, contacts, sites, queues, SLA policies, contracts, KB, saved views, and administrative ticket metadata.
- Add ticket actions for public replies, internal notes, time entries, attachments, assignment, resolve, close, reopen, archive, and bulk updates.
- Validate every foreign key against the active `orgId`; never accept a client/site/contact/asset/user/queue ID from another tenant.
- Sanitize text/HTML on write, restrict upload size and MIME type, generate server-side storage names, and never expose storage paths.
- Hide internal notes from `staff`/client-facing and `readonly` responses unless their role explicitly permits internal service operations.
- Record before/after audit metadata for every service-desk mutation.

### Core interfaces

- Register `/app` as the authenticated service desk dashboard.
- Restore Clients with list, profile, sites, contacts, tickets, assets, notes, and activity.
- Upgrade Assets with service-desk fields and related tickets.
- Upgrade Tickets with server-side pagination/search/filter/sort/saved views and full ticket workspace tabs.
- Add Knowledge Base and Service Desk Administration pages.
- Retain PulseDesk's clinical operations visual language; do not replace it with a generic MSP mock dashboard.

### OperatorOS integration

- Use `OPERATOROS_MY_APPS_URL` for Return to OperatorOS and coordinated logout redirects.
- Keep OperatorOS as the only production login, billing, subscription, and entitlement authority.
- Preserve the local-auth code only as a disabled development/legacy compatibility path; do not present it as a second production identity system.

### Verification gates

1. TypeScript check and production build.
2. Static auth/route/SSO/webhook smoke suite.
3. Schema migration against a disposable PostgreSQL database when `DATABASE_URL` is available.
4. Automated workflow test: SSO launch, client, contact, asset, ticket, assignment, internal note, public reply, time entry, resolve, close, persistence, role denial, cross-tenant denial, return to OperatorOS.
5. Manual live OperatorOS launch/consume verification remains deployment-environment work because one-time SSO tokens and tenant configuration are external to this repository.

## Explicit non-restorations

- Standalone Stripe checkout or PulseDesk-owned plans.
- Separate customer passwords or a new PulseDesk login system.
- Historical field-service jobs, estimates, quotes, and invoices.
- Mock-only widgets or non-persistent client-side demo data.

