import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const schema = read("shared/schema.ts");
const routes = read("server/routes/serviceDesk.ts");
const ticketRoutes = read("server/routes/tickets.ts");
const app = read("client/src/App.tsx");
const migration = read("server/serviceDeskMigration.ts");
const checks = [];
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) });

for (const table of [
  "clients", "sites", "contacts", "queues", "teams", "team_members", "ticket_statuses", "ticket_priorities", "ticket_types",
  "ticket_categories", "sla_policies", "sla_events", "time_entries", "devices", "contracts", "knowledge_articles", "attachments",
  "tags", "notification_preferences", "activity_events",
]) check(`tenant table ${table}`, schema.includes(`pgTable("${table}"`) && migration.includes(`TABLE IF NOT EXISTS ${table}`));

for (const route of [
  '"/api/clients"', '"/api/service-desk/tickets"', '"/api/tickets/:id/workspace"', '"/api/tickets/:id/replies"',
  '"/api/tickets/:id/internal-notes"', '"/api/tickets/:id/time-entries"', '"/api/tickets/:id/assignments"',
  '"/api/tickets/:id/actions/:action"', '"/api/tickets/:id/attachments"', '"/api/knowledge/articles"',
]) check(`service route ${route}`, routes.includes(route));

check("tenant reference enforcement", routes.includes("CROSS_TENANT_REFERENCE") && ticketRoutes.includes("validateTicketTenantReferences"));
check("internal notes require technician", routes.includes('"/api/tickets/:id/internal-notes"') && routes.includes('requireMinRole("technician")'));
check("attachment restrictions", routes.includes("MAX_ATTACHMENT_BYTES") && routes.includes("ALLOWED_ATTACHMENT_TYPES") && routes.includes("checksumSha256"));
check("SLA targets and outcome events", ticketRoutes.includes("response_target_started") && ticketRoutes.includes("resolution_target_started") && routes.includes("response_breached") && routes.includes("resolution_breached"));
check("canonical /app route", app.includes('path="/app"') && read("server/routes/sso.ts").includes('res.redirect(302, "/app")'));
check("OperatorOS return is absolute server redirect", read("server/routes/operatorOsNavigation.ts").includes('new URL("/app", base)'));

let failed = 0;
for (const item of checks) { console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`); if (!item.condition) failed++; }
if (failed) { console.error(`Service desk smoke failed: ${failed} checks.`); process.exit(1); }
