import assert from "node:assert/strict";

const baseUrl = process.env.PULSEDESK_E2E_BASE_URL?.replace(/\/$/, "");
const ssoToken = process.env.PULSEDESK_E2E_SSO_TOKEN;
if (!baseUrl || !ssoToken) {
  console.log("SKIP service desk E2E: set PULSEDESK_E2E_BASE_URL and a fresh PULSEDESK_E2E_SSO_TOKEN.");
  process.exit(0);
}

let cookie = "";
async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, redirect: options.redirect ?? "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return response;
}
async function json(pathname, options = {}, expected = [200, 201]) {
  const response = await request(pathname, options);
  const body = await response.json().catch(() => ({}));
  assert.ok(expected.includes(response.status), `${pathname}: expected ${expected.join("/")}, received ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const launch = await request(`/sso?token=${encodeURIComponent(ssoToken)}`);
assert.equal(launch.status, 302);
assert.equal(new URL(launch.headers.get("location"), baseUrl).pathname, "/app");
assert.ok(cookie, "SSO launch must establish a PulseDesk session");
const me = await json("/api/auth/me");
const suffix = Date.now().toString(36).toUpperCase();
const client = await json("/api/clients", { method: "POST", body: JSON.stringify({ name: `E2E Client ${suffix}`, clientCode: `E2E${suffix}`, email: `e2e-${suffix.toLowerCase()}@example.test` }) });
const contact = await json(`/api/clients/${client.id}/contacts`, { method: "POST", body: JSON.stringify({ firstName: "E2E", lastName: "Requester", email: `requester-${suffix.toLowerCase()}@example.test` }) });
const asset = await json("/api/assets", { method: "POST", body: JSON.stringify({ assetTag: `E2E-${suffix}`, name: "E2E Workstation", assetType: "workstation", serialNumber: suffix, clientId: client.id, status: "active" }) });
const ticket = await json("/api/tickets", { method: "POST", body: JSON.stringify({ title: `E2E persistence ${suffix}`, description: "Automated OperatorOS service desk workflow", category: "it_infrastructure", priority: "normal", clientId: client.id, contactId: contact.id, assetId: asset.id }) });
await json(`/api/tickets/${ticket.id}/assignments`, { method: "POST", body: JSON.stringify({ technicianId: me.user.id }) });
const note = await json(`/api/tickets/${ticket.id}/internal-notes`, { method: "POST", body: JSON.stringify({ body: "Internal diagnostic note" }) });
const reply = await json(`/api/tickets/${ticket.id}/replies`, { method: "POST", body: JSON.stringify({ body: "Public requester update" }) });
const time = await json(`/api/tickets/${ticket.id}/time-entries`, { method: "POST", body: JSON.stringify({ minutes: 30, description: "E2E diagnostic work", workType: "remote" }) });
await json(`/api/tickets/${ticket.id}/actions/resolve`, { method: "POST", body: JSON.stringify({ rootCause: "E2E validation", resolutionSummary: "Workflow completed" }) });
await json(`/api/tickets/${ticket.id}/actions/close`, { method: "POST", body: "{}" });
const workspace = await json(`/api/tickets/${ticket.id}/workspace`);
assert.equal(workspace.ticket.status, "closed");
assert.ok(workspace.internalNotes.some((item) => item.id === note.id));
assert.ok(workspace.comments.some((item) => item.id === reply.id));
assert.ok(workspace.timeEntries.some((item) => item.id === time.id));

const staffToken = process.env.PULSEDESK_E2E_STAFF_SSO_TOKEN;
if (staffToken) {
  cookie = "";
  await request(`/sso?token=${encodeURIComponent(staffToken)}`);
  const forbiddenNote = await request(`/api/tickets/${ticket.id}/internal-notes`, { method: "POST", body: JSON.stringify({ body: "must be rejected" }) });
  assert.equal(forbiddenNote.status, 403, "Staff role must not add internal notes");
  const staffWorkspace = await json(`/api/tickets/${ticket.id}/workspace`);
  assert.deepEqual(staffWorkspace.internalNotes, [], "Staff workspace must not expose internal notes");
} else {
  console.log("SKIP role live subtest: set a same-tenant PULSEDESK_E2E_STAFF_SSO_TOKEN.");
}

const foreignToken = process.env.PULSEDESK_E2E_SECOND_TENANT_SSO_TOKEN;
if (foreignToken) {
  cookie = "";
  await request(`/sso?token=${encodeURIComponent(foreignToken)}`);
  const foreignRead = await request(`/api/clients/${client.id}`);
  assert.equal(foreignRead.status, 404, "A second tenant must not read the first tenant's client");
  const forged = await request("/api/tickets", { method: "POST", body: JSON.stringify({ title: "Cross tenant rejection", category: "other", priority: "normal", clientId: client.id }) });
  assert.equal(forged.status, 400, "A second tenant must not reference the first tenant's client");
} else {
  console.log("SKIP cross-tenant live subtest: set PULSEDESK_E2E_SECOND_TENANT_SSO_TOKEN.");
}

const returnResponse = await request("/operatoros/return");
assert.equal(returnResponse.status, 302);
assert.equal(new URL(returnResponse.headers.get("location")).pathname, "/app");
console.log(`PASS service desk E2E ${ticket.ticketNumber}`);
