# PulseDesk Service Desk Implementation Report

Generated: 2026-07-15

## Outcome

PulseDesk now launches its authenticated application at `/app` and provides persistent, tenant-scoped service-desk workflows instead of a placeholder route. The original healthcare operations application remains intact and is extended with client management, a complete ticket workspace, asset service records, knowledge, administrative workflow configuration, audit history, attachments, time tracking, SLA records, and OperatorOS return/logout behavior.

## Application routes

| Route | Purpose |
|---|---|
| `/app`, `/`, `/dashboard` | Authenticated service-desk and healthcare operations dashboard |
| `/tickets` | Paginated ticket queue, search, filters, sorting, saved views |
| `/tickets/:id` | Ticket conversation, internal work, files, time, SLA and audit workspace |
| `/submit` | Quick/create ticket with client, contact, site and queue associations |
| `/clients` | Client search, pagination and creation |
| `/clients/:id` | Client profile, sites, contacts, tickets, assets and activity |
| `/assets` | Asset inventory and service metadata |
| `/knowledge` | Searchable role-gated knowledge base |
| `/service-desk/admin` | Status, priority, type, category, queue, team and SLA administration |
| `/operatoros/return` | Absolute redirect to canonical OperatorOS My Apps |
| `/logout` | Local session destruction followed by coordinated OperatorOS logout |

Existing PulseDesk routes for departments, vendors, supply requests, facility requests, analytics, notifications, email connectors, profile, settings and system administration remain mounted.

## Persistent tables

Restored or added service-desk tables:

- `clients`, `sites`, `contacts`
- `tickets`, `ticket_events`, `ticket_comments`, `ticket_internal_notes`, `ticket_assignments`, `ticket_counters`
- `ticket_statuses`, `ticket_priorities`, `ticket_types`, `ticket_categories`
- `queues`, `teams`, `team_members`
- `sla_policies`, `sla_events`, `time_entries`
- `assets`, `devices`, `vendors`, `contracts`
- `knowledge_categories`, `knowledge_articles`
- `attachments`, `tags`, `ticket_tags`
- `saved_views`, `notification_preferences`, `notifications`, `activity_events`, `auth_audit_log`

Every service-desk record carries `org_id` directly or is reachable only through a tenant-scoped parent. Human ticket identifiers are generated atomically per tenant in the form `PD-{TENANT}-{SEQUENCE}`.

## APIs

- Clients: `GET/POST /api/clients`, `GET/PATCH /api/clients/:id`
- Client children: `POST /api/clients/:clientId/sites`, `POST /api/clients/:clientId/contacts`
- Tickets: `GET /api/service-desk/tickets`, existing ticket CRUD, `GET /api/tickets/:id/workspace`
- Ticket work: replies, internal notes, time entries, assignment, tags, attachments and attachment download under `/api/tickets/:id/*`
- Lifecycle: `POST /api/tickets/:id/actions/{resolve|close|reopen|archive}`
- Assets/devices: existing asset CRUD plus `GET/POST /api/assets/:id/devices`
- Operations: `/api/queues`, `/api/sla-policies`, `/api/contracts`, `/api/tags`, `/api/teams/:id/members`
- Knowledge: `/api/knowledge/categories`, `/api/knowledge/articles`
- Preferences/views: `/api/saved-views`, `/api/notification-preferences`
- Administration: `GET /api/service-desk/config`, `POST /api/service-desk/config/:kind`
- Audit: `GET /api/activity`
- OperatorOS: `GET /api/public/operatoros-navigation`, `GET /operatoros/return`, `GET /logout`

## Restored and extended features

- Original healthcare dashboard, tickets, departments, assets, vendors, supply/facility requests, analytics, notifications and email-to-ticket remain available.
- `/app` now resolves to the authenticated product instead of falling through to a placeholder or 404.
- Ticket create/view/edit, assignment, queue, status, priority, category, client/contact/site/asset association, public replies, internal notes, attachments, time entries, resolve, close, reopen and archive are persistent.
- The selected or tenant-default SLA policy sets persistent response/resolution targets; first response, resolution, breach, policy-change and reopen outcomes are recorded in `sla_events`.
- Ticket list supports server-side pagination, search, filters, ordering and saved views.
- Client profiles aggregate sites, contacts, tickets, assets and service activity.
- Asset records include serial number, client/site, assigned user, warranty dates, notes, devices and related ticket context.
- Knowledge articles support categories, search, draft/published state and role-based authoring.
- Administration manages service workflow metadata, queues, teams and SLA policies.
- Production authentication remains OperatorOS-only; no separate production password authority was introduced.

## Security controls

- All protected APIs require an authenticated OperatorOS-derived session and active tenant context.
- Every lookup and mutation includes `org_id`; relationship IDs are revalidated against the active tenant before use.
- Staff/client-facing roles never receive internal-note or internal-attachment content.
- Role gates are enforced server-side for assignment, workflow administration, KB editing and archive operations.
- User text is reduced to sanitized plain text before persistence.
- Attachments are limited to 10 MiB and an explicit MIME allowlist, stored with random server keys outside the public tree, hashed with SHA-256, and downloaded only through a tenant-checked API.
- Mutations write service activity events with actor, action, entity, before/after state and request IP where available.
- Ticket delete now archives; it does not physically destroy the service record.

## Tests and verification

| Check | Result |
|---|---|
| `npm run check` | Pass |
| `npm run build` | Pass; only existing Browserslist/PostCSS warnings |
| `npm run smoke` | Pass for route, service-desk, unauthenticated-route, SSO static and webhook static checks; optional live checks depend on deployment env |
| `npx drizzle-kit migrate` against disposable PostgreSQL 16 | Pass |
| Runtime `ensureSchema()` against the migrated database | Pass and idempotent |
| `npm run test:e2e:service-desk` | Implemented; local run skips without a deployed base URL and fresh OperatorOS one-time SSO tokens |

The live E2E covers OperatorOS authentication, client/contact/asset/ticket creation, assignment, internal note, public reply, time entry, resolve/close, reload persistence, role restrictions, cross-tenant isolation and return to OperatorOS. The staff and second-tenant assertions run when their optional one-time tokens are supplied.

## Environment variables

Core production variables remain `DATABASE_URL`, `SESSION_SECRET`, `MODULE_SSO_SECRET`, `OPERATOROS_BASE_URL`, `OPERATOROS_SSO_AUDIENCE`, `OPERATOROS_SSO_ENV`, `OPERATOROS_SSO_CONSUME_URL`, `OPERATOROS_SERVICE_TOKEN`, `APP_BASE_URL` and the documented entitlement endpoints.

New/clarified variables:

- `OPERATOROS_MY_APPS_URL` — optional; defaults to `{OPERATOROS_BASE_URL}/app`
- `OPERATOROS_LOGOUT_URL` — optional; defaults to `{OPERATOROS_BASE_URL}/logout`
- `ATTACHMENT_STORAGE_DIR` — private durable upload storage; defaults to `data/attachments`
- `PULSEDESK_LOCAL_AUTH_ENABLED` — development only and ignored as a production login option
- `PULSEDESK_E2E_BASE_URL`, `PULSEDESK_E2E_SSO_TOKEN` — required for live E2E
- `PULSEDESK_E2E_STAFF_SSO_TOKEN`, `PULSEDESK_E2E_SECOND_TENANT_SSO_TOKEN` — optional but required to execute all role/isolation assertions

## Deployment

1. Back up PostgreSQL and configure the documented OperatorOS/attachment variables.
2. Mount `ATTACHMENT_STORAGE_DIR` on durable private storage.
3. Install dependencies with `npm ci`.
4. Apply migrations with `npx drizzle-kit migrate`.
5. Run `npm run check`, `npm run build` and `npm run smoke`.
6. Start with `npm run start`; verify `/api/health`.
7. Launch through OperatorOS into `/app`, then run `npm run test:e2e:service-desk` with fresh one-time tokens.
8. Verify entitlement revocation and coordinated logout in the production OperatorOS environment.

## Remaining limitations

- A live OperatorOS SSO E2E could not be executed in the local workspace without deployment URLs and fresh one-time tokens. The test is present and fails on workflow assertions when configured; it does not simulate SSO.
- Attachments use private filesystem storage. Multi-instance deployments must mount shared durable storage or replace the storage adapter with object storage before horizontal scaling.
- Existing PulseDesk role names remain the authorization model; external client portal accounts and client-side ticket visibility were not introduced.
- SLA target/outcome persistence and due-time display are implemented, but calendar-aware business hours, holidays, pause conditions and background escalation notifications need a dedicated scheduler for full contractual SLA automation.
- Bulk ticket actions are intentionally limited until each operation has an explicit safe role/validation contract.
