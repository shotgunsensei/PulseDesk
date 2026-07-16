import { Router, type Request } from "express";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { db, pool } from "../db";
import { requireAuth, requireMinRole, requireOrg } from "../middleware";
import { storage } from "../storage";
import { hasRole } from "@shared/roles";
import {
  activityEvents,
  assets,
  attachments,
  clients,
  contacts,
  contracts,
  devices,
  knowledgeArticles,
  knowledgeCategories,
  notificationPreferences,
  queues,
  savedViews,
  sites,
  slaEvents,
  slaPolicies,
  teams,
  teamMembers,
  ticketAssignments,
  ticketCategories,
  ticketComments,
  ticketInternalNotes,
  ticketPriorities,
  ticketStatuses,
  ticketTypes,
  tags,
  ticketTags,
  tickets,
  timeEntries,
  users,
} from "@shared/schema";

const router = Router();
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function cleanText(value: unknown, max = 20_000): string {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

function slugify(value: string): string {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pageParams(req: Request) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  return typeof value === "string" ? value : undefined;
}

async function tenantRefExists(orgId: string, tableName: string, id: unknown): Promise<boolean> {
  if (!id) return true;
  const allowed = new Set(["clients", "sites", "contacts", "assets", "queues", "teams", "sla_policies", "vendors", "departments", "ticket_types", "ticket_statuses", "ticket_priorities", "ticket_categories", "users"]);
  if (!allowed.has(tableName)) return false;
  if (tableName === "users") {
    const result = await pool.query(
      "SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2 LIMIT 1",
      [orgId, String(id)],
    );
    return result.rowCount === 1;
  }
  const result = await pool.query(`SELECT 1 FROM ${tableName} WHERE org_id = $1 AND id = $2 LIMIT 1`, [orgId, String(id)]);
  return result.rowCount === 1;
}

export async function validateTicketTenantReferences(orgId: string, input: Record<string, unknown>) {
  const refs: Array<[string, string]> = [
    ["clientId", "clients"], ["siteId", "sites"], ["contactId", "contacts"], ["assetId", "assets"],
    ["queueId", "queues"], ["teamId", "teams"], ["slaPolicyId", "sla_policies"], ["assignedTo", "users"],
    ["departmentId", "departments"], ["ticketTypeId", "ticket_types"], ["statusConfigId", "ticket_statuses"],
    ["priorityConfigId", "ticket_priorities"], ["categoryConfigId", "ticket_categories"],
  ];
  for (const [field, table] of refs) {
    if (field in input && input[field] && !(await tenantRefExists(orgId, table, input[field]))) {
      throw Object.assign(new Error(`${field} does not belong to the active tenant`), { status: 400, code: "CROSS_TENANT_REFERENCE" });
    }
  }
  if (input.siteId && input.clientId) {
    const result = await pool.query("SELECT 1 FROM sites WHERE org_id = $1 AND id = $2 AND client_id = $3", [orgId, input.siteId, input.clientId]);
    if (result.rowCount !== 1) throw Object.assign(new Error("Site does not belong to the selected client"), { status: 400, code: "INVALID_CLIENT_SITE" });
  }
  if (input.contactId && input.clientId) {
    const result = await pool.query("SELECT 1 FROM contacts WHERE org_id = $1 AND id = $2 AND client_id = $3", [orgId, input.contactId, input.clientId]);
    if (result.rowCount !== 1) throw Object.assign(new Error("Contact does not belong to the selected client"), { status: 400, code: "INVALID_CLIENT_CONTACT" });
  }
}

async function audit(req: Request, entityType: string, entityId: string, action: string, before: unknown, after: unknown, summary = "") {
  await db.insert(activityEvents).values({
    orgId: req.session.orgId!, actorUserId: req.session.userId!, entityType, entityId, action,
    before: before as any, after: after as any, summary: cleanText(summary, 500),
    ipAddress: req.ip ?? null,
  });
}

const clientInput = z.object({
  name: z.string().min(1).max(200), clientCode: z.string().min(1).max(50), status: z.string().max(30).optional(),
  phone: z.string().max(50).optional(), email: z.string().email().or(z.literal("")).optional(), website: z.string().max(300).optional(),
  address: z.string().max(1000).optional(), notes: z.string().max(20_000).optional(),
});

router.get("/api/clients", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const { page, pageSize, offset } = pageParams(req);
  const q = cleanText(req.query.q, 200);
  const conditions = [eq(clients.orgId, orgId), sql`${clients.archivedAt} IS NULL`];
  if (q) conditions.push(or(ilike(clients.name, `%${q}%`), ilike(clients.clientCode, `%${q}%`), ilike(clients.email, `%${q}%`))!);
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    db.select().from(clients).where(where).orderBy(asc(clients.name)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(clients).where(where),
  ]);
  res.json({ items: rows, page, pageSize, total: Number(totals[0]?.count ?? 0) });
});

router.post("/api/clients", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const parsed = clientInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid client", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const data = parsed.data;
  const [created] = await db.insert(clients).values({ ...data, orgId: req.session.orgId!, name: cleanText(data.name, 200), clientCode: cleanText(data.clientCode, 50).toUpperCase(), notes: cleanText(data.notes) }).returning();
  await audit(req, "client", created.id, "created", null, created, `Client ${created.name} created`);
  res.status(201).json(created);
});

router.get("/api/clients/:id", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const [client] = await db.select().from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, routeParam(req, "id"))));
  if (!client) return res.status(404).json({ error: "Client not found" });
  const [clientSites, clientContacts, clientTickets, clientAssets, activity] = await Promise.all([
    db.select().from(sites).where(and(eq(sites.orgId, orgId), eq(sites.clientId, client.id))).orderBy(asc(sites.name)),
    db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.clientId, client.id))).orderBy(asc(contacts.lastName)),
    db.select().from(tickets).where(and(eq(tickets.orgId, orgId), eq(tickets.clientId, client.id))).orderBy(desc(tickets.updatedAt)),
    db.select().from(assets).where(and(eq(assets.orgId, orgId), eq(assets.clientId, client.id))).orderBy(asc(assets.name)),
    db.select().from(activityEvents).where(and(eq(activityEvents.orgId, orgId), eq(activityEvents.entityId, client.id))).orderBy(desc(activityEvents.createdAt)).limit(100),
  ]);
  res.json({ ...client, sites: clientSites, contacts: clientContacts, tickets: clientTickets, assets: clientAssets, activity });
});

router.patch("/api/clients/:id", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const [before] = await db.select().from(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, routeParam(req, "id"))));
  if (!before) return res.status(404).json({ error: "Client not found" });
  const parsed = clientInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid client", details: parsed.error.flatten() });
  const data = parsed.data;
  const [updated] = await db.update(clients).set({ ...data, name: data.name ? cleanText(data.name, 200) : undefined, notes: data.notes === undefined ? undefined : cleanText(data.notes), updatedAt: new Date() }).where(and(eq(clients.orgId, orgId), eq(clients.id, before.id))).returning();
  await audit(req, "client", updated.id, "updated", before, updated, `Client ${updated.name} updated`);
  res.json(updated);
});

const siteInput = z.object({ name: z.string().min(1).max(200), siteCode: z.string().min(1).max(50), address1: z.string().max(300).optional(), address2: z.string().max(300).optional(), city: z.string().max(120).optional(), state: z.string().max(80).optional(), postalCode: z.string().max(30).optional(), country: z.string().max(80).optional(), phone: z.string().max(50).optional(), timezone: z.string().max(80).optional(), notes: z.string().max(20_000).optional() });
router.post("/api/clients/:clientId/sites", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const clientId = routeParam(req, "clientId");
  if (!(await tenantRefExists(orgId, "clients", clientId))) return res.status(404).json({ error: "Client not found" });
  const parsed = siteInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid site", details: parsed.error.flatten() });
  const [created] = await db.insert(sites).values({ ...parsed.data, orgId, clientId, name: cleanText(parsed.data.name, 200), siteCode: cleanText(parsed.data.siteCode, 50).toUpperCase(), notes: cleanText(parsed.data.notes) }).returning();
  await audit(req, "site", created.id, "created", null, created, `Site ${created.name} created`);
  res.status(201).json(created);
});

const contactInput = z.object({ firstName: z.string().min(1).max(100), lastName: z.string().max(100).optional(), siteId: z.string().uuid().nullable().optional(), title: z.string().max(150).optional(), email: z.string().email().or(z.literal("")).optional(), phone: z.string().max(50).optional(), mobile: z.string().max(50).optional(), isPrimary: z.boolean().optional(), isActive: z.boolean().optional(), notes: z.string().max(20_000).optional() });
router.post("/api/clients/:clientId/contacts", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const clientId = routeParam(req, "clientId");
  if (!(await tenantRefExists(orgId, "clients", clientId))) return res.status(404).json({ error: "Client not found" });
  const parsed = contactInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid contact", details: parsed.error.flatten() });
  if (parsed.data.siteId) await validateTicketTenantReferences(orgId, { clientId, siteId: parsed.data.siteId });
  const [created] = await db.insert(contacts).values({ ...parsed.data, orgId, clientId, firstName: cleanText(parsed.data.firstName, 100), notes: cleanText(parsed.data.notes) }).returning();
  await audit(req, "contact", created.id, "created", null, created, `Contact ${created.firstName} ${created.lastName ?? ""} created`);
  res.status(201).json(created);
});

router.get("/api/service-desk/tickets", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const { page, pageSize, offset } = pageParams(req);
  const q = cleanText(req.query.q, 200);
  const conditions = [eq(tickets.orgId, orgId)];
  if (req.query.archived !== "true") conditions.push(sql`${tickets.archivedAt} IS NULL`);
  const status = queryString(req, "status");
  const priority = queryString(req, "priority");
  const category = queryString(req, "category");
  const clientId = queryString(req, "clientId");
  const queueId = queryString(req, "queueId");
  const assignedTo = queryString(req, "assignedTo");
  if (status) conditions.push(eq(tickets.status, status as any));
  if (priority) conditions.push(eq(tickets.priority, priority as any));
  if (category) conditions.push(eq(tickets.category, category as any));
  if (clientId) conditions.push(eq(tickets.clientId, clientId));
  if (queueId) conditions.push(eq(tickets.queueId, queueId));
  if (assignedTo) conditions.push(eq(tickets.assignedTo, assignedTo));
  if (queryString(req, "unassigned") === "true") conditions.push(sql`${tickets.assignedTo} IS NULL`);
  if (q) conditions.push(or(ilike(tickets.title, `%${q}%`), ilike(tickets.ticketNumber, `%${q}%`), ilike(tickets.description, `%${q}%`))!);
  const where = and(...conditions);
  const [items, totals] = await Promise.all([
    db.select({ ticket: tickets, clientName: clients.name, siteName: sites.name, contactFirstName: contacts.firstName, contactLastName: contacts.lastName, queueName: queues.name })
      .from(tickets).leftJoin(clients, and(eq(clients.id, tickets.clientId), eq(clients.orgId, orgId)))
      .leftJoin(sites, and(eq(sites.id, tickets.siteId), eq(sites.orgId, orgId)))
      .leftJoin(contacts, and(eq(contacts.id, tickets.contactId), eq(contacts.orgId, orgId)))
      .leftJoin(queues, and(eq(queues.id, tickets.queueId), eq(queues.orgId, orgId)))
      .where(where).orderBy(queryString(req, "order") === "asc" ? asc(tickets.updatedAt) : desc(tickets.updatedAt)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(tickets).where(where),
  ]);
  res.json({ items: items.map((row) => ({ ...row.ticket, clientName: row.clientName, siteName: row.siteName, contactName: [row.contactFirstName, row.contactLastName].filter(Boolean).join(" "), queueName: row.queueName })), page, pageSize, total: Number(totals[0]?.count ?? 0) });
});

router.get("/api/tickets/:id/workspace", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const membership = await storage.getMembership(orgId, req.session.userId!);
  const canSeeInternal = !!membership && hasRole(membership.role, "technician");
  const [comments, notes, worklog, files, assignments, sla, activity] = await Promise.all([
    db.select().from(ticketComments).where(and(eq(ticketComments.orgId, orgId), eq(ticketComments.ticketId, ticket.id))).orderBy(asc(ticketComments.createdAt)),
    canSeeInternal ? db.select().from(ticketInternalNotes).where(and(eq(ticketInternalNotes.orgId, orgId), eq(ticketInternalNotes.ticketId, ticket.id))).orderBy(asc(ticketInternalNotes.createdAt)) : Promise.resolve([]),
    canSeeInternal ? db.select().from(timeEntries).where(and(eq(timeEntries.orgId, orgId), eq(timeEntries.ticketId, ticket.id))).orderBy(desc(timeEntries.createdAt)) : Promise.resolve([]),
    db.select({ id: attachments.id, originalName: attachments.originalName, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes, isInternal: attachments.isInternal, createdAt: attachments.createdAt }).from(attachments).where(and(eq(attachments.orgId, orgId), eq(attachments.ticketId, ticket.id), canSeeInternal ? sql`true` : eq(attachments.isInternal, false))),
    db.select().from(ticketAssignments).where(and(eq(ticketAssignments.orgId, orgId), eq(ticketAssignments.ticketId, ticket.id))).orderBy(desc(ticketAssignments.assignedAt)),
    db.select().from(slaEvents).where(and(eq(slaEvents.orgId, orgId), eq(slaEvents.ticketId, ticket.id))).orderBy(asc(slaEvents.occurredAt)),
    db.select().from(activityEvents).where(and(eq(activityEvents.orgId, orgId), eq(activityEvents.entityType, "ticket"), eq(activityEvents.entityId, ticket.id))).orderBy(desc(activityEvents.createdAt)),
  ]);
  res.json({ ticket, comments, internalNotes: notes, timeEntries: worklog, attachments: files, assignments, slaEvents: sla, auditHistory: activity });
});

router.post("/api/tickets/:id/replies", requireAuth, requireOrg, requireMinRole("staff"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const body = cleanText(req.body.body);
  if (!body) return res.status(400).json({ error: "Reply body is required" });
  const [created] = await db.insert(ticketComments).values({ orgId, ticketId: ticket.id, body, createdBy: req.session.userId! }).returning();
  if (!ticket.firstRespondedAt) {
    const respondedAt = new Date();
    await db.update(tickets).set({ firstRespondedAt: respondedAt, updatedAt: respondedAt }).where(and(eq(tickets.orgId, orgId), eq(tickets.id, ticket.id)));
    await db.insert(slaEvents).values({
      orgId, ticketId: ticket.id, slaPolicyId: ticket.slaPolicyId, targetAt: ticket.responseDueAt,
      eventType: ticket.responseDueAt && respondedAt > new Date(ticket.responseDueAt) ? "response_breached" : "response_met",
      metadata: { respondedAt: respondedAt.toISOString() },
    });
  }
  await storage.createTicketEvent(orgId, ticket.id, "public_reply", "Public reply added", req.session.userId!);
  await audit(req, "ticket", ticket.id, "public_reply_added", null, { commentId: created.id }, `Public reply added to ${ticket.ticketNumber}`);
  res.status(201).json(created);
});

router.post("/api/tickets/:id/internal-notes", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const body = cleanText(req.body.body);
  if (!body) return res.status(400).json({ error: "Note body is required" });
  const [created] = await db.insert(ticketInternalNotes).values({ orgId, ticketId: ticket.id, body, createdBy: req.session.userId! }).returning();
  await storage.createTicketEvent(orgId, ticket.id, "internal_note", "Internal note added", req.session.userId!);
  await audit(req, "ticket", ticket.id, "internal_note_added", null, { noteId: created.id }, `Internal note added to ${ticket.ticketNumber}`);
  res.status(201).json(created);
});

const timeInput = z.object({ minutes: z.number().int().min(1).max(1440), workType: z.enum(["remote", "onsite", "travel", "admin"]).optional(), description: z.string().max(5000).optional(), billable: z.boolean().optional(), startedAt: z.coerce.date().nullable().optional(), endedAt: z.coerce.date().nullable().optional() });
router.post("/api/tickets/:id/time-entries", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const parsed = timeInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid time entry", details: parsed.error.flatten() });
  const [created] = await db.insert(timeEntries).values({ ...parsed.data, description: cleanText(parsed.data.description, 5000), orgId, ticketId: ticket.id, userId: req.session.userId! }).returning();
  await storage.createTicketEvent(orgId, ticket.id, "time_entry", `${created.minutes} minutes logged`, req.session.userId!);
  await audit(req, "ticket", ticket.id, "time_entry_added", null, created, `${created.minutes} minutes logged to ${ticket.ticketNumber}`);
  res.status(201).json(created);
});

const assignmentInput = z.object({ technicianId: z.string().uuid().nullable().optional(), queueId: z.string().uuid().nullable().optional(), teamId: z.string().uuid().nullable().optional() });
router.post("/api/tickets/:id/assignments", requireAuth, requireOrg, requireMinRole("supervisor"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const parsed = assignmentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid assignment", details: parsed.error.flatten() });
  await validateTicketTenantReferences(orgId, { assignedTo: parsed.data.technicianId, queueId: parsed.data.queueId, teamId: parsed.data.teamId });
  await db.update(ticketAssignments).set({ unassignedAt: new Date() }).where(and(eq(ticketAssignments.orgId, orgId), eq(ticketAssignments.ticketId, ticket.id), sql`${ticketAssignments.unassignedAt} IS NULL`));
  const [created] = await db.insert(ticketAssignments).values({ orgId, ticketId: ticket.id, technicianId: parsed.data.technicianId, queueId: parsed.data.queueId, teamId: parsed.data.teamId, assignedBy: req.session.userId! }).returning();
  const [updated] = await db.update(tickets).set({ assignedTo: parsed.data.technicianId, queueId: parsed.data.queueId, teamId: parsed.data.teamId, status: ticket.status === "new" ? "assigned" : ticket.status, updatedAt: new Date() }).where(and(eq(tickets.orgId, orgId), eq(tickets.id, ticket.id))).returning();
  await audit(req, "ticket", ticket.id, "assigned", ticket, updated, `Assignment updated for ${ticket.ticketNumber}`);
  res.status(201).json(created);
});

const actionSchema = z.object({ resolutionSummary: z.string().max(20_000).optional(), rootCause: z.string().max(20_000).optional() });
router.post("/api/tickets/:id/actions/:action", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const action = routeParam(req, "action");
  if (!["resolve", "close", "reopen", "archive"].includes(action)) return res.status(400).json({ error: "Unsupported action" });
  const parsed = actionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid action payload" });
  if (action === "archive") {
    const membership = await storage.getMembership(orgId, req.session.userId!);
    if (!membership || !hasRole(membership.role, "supervisor")) return res.status(403).json({ error: "Supervisor role required", code: "INSUFFICIENT_ROLE" });
  }
  const now = new Date();
  const changes: Record<string, unknown> = { updatedAt: now };
  if (action === "resolve") Object.assign(changes, { status: "resolved", resolvedAt: now, resolutionSummary: cleanText(parsed.data.resolutionSummary), rootCause: cleanText(parsed.data.rootCause) });
  if (action === "close") Object.assign(changes, { status: "closed", closedAt: now });
  if (action === "reopen") Object.assign(changes, { status: "in_progress", reopenedAt: now, resolvedAt: null, closedAt: null, archivedAt: null, archivedBy: null });
  if (action === "archive") Object.assign(changes, { archivedAt: now, archivedBy: req.session.userId! });
  const [updated] = await db.update(tickets).set(changes as any).where(and(eq(tickets.orgId, orgId), eq(tickets.id, ticket.id))).returning();
  if (action === "resolve") {
    await db.insert(slaEvents).values({
      orgId, ticketId: ticket.id, slaPolicyId: ticket.slaPolicyId, targetAt: ticket.resolutionDueAt,
      eventType: ticket.resolutionDueAt && now > new Date(ticket.resolutionDueAt) ? "resolution_breached" : "resolution_met",
      metadata: { resolvedAt: now.toISOString() },
    });
  } else if (action === "reopen") {
    await db.insert(slaEvents).values({ orgId, ticketId: ticket.id, slaPolicyId: ticket.slaPolicyId, eventType: "reopened", targetAt: ticket.resolutionDueAt, metadata: {} });
  }
  await storage.createTicketEvent(orgId, ticket.id, action, `Ticket ${action}d`, req.session.userId!);
  await audit(req, "ticket", ticket.id, action, ticket, updated, `${ticket.ticketNumber} ${action}d`);
  res.json(updated);
});

const attachmentInput = z.object({ originalName: z.string().min(1).max(255), mimeType: z.string().min(1).max(150), dataBase64: z.string().min(1), isInternal: z.boolean().optional() });
router.post("/api/tickets/:id/attachments", requireAuth, requireOrg, requireMinRole("staff"), async (req, res) => {
  const orgId = req.session.orgId!;
  const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const parsed = attachmentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid attachment", details: parsed.error.flatten() });
  if (!ALLOWED_ATTACHMENT_TYPES.has(parsed.data.mimeType)) return res.status(415).json({ error: "File type is not allowed", code: "UNSUPPORTED_FILE_TYPE" });
  const bytes = Buffer.from(parsed.data.dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return res.status(413).json({ error: "Attachment exceeds the 10 MB limit", code: "FILE_TOO_LARGE" });
  if (parsed.data.isInternal) {
    const membership = await storage.getMembership(orgId, req.session.userId!);
    if (!membership || !hasRole(membership.role, "technician")) return res.status(403).json({ error: "Internal attachments require technician access" });
  }
  const extension = path.extname(parsed.data.originalName).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 10);
  const storageKey = `${orgId}/${ticket.id}/${randomUUID()}${extension}`;
  const root = path.resolve(process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), "data", "attachments"));
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return res.status(400).json({ error: "Invalid storage path" });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const [created] = await db.insert(attachments).values({ orgId, ticketId: ticket.id, uploadedBy: req.session.userId!, originalName: cleanText(parsed.data.originalName, 255), storageKey, mimeType: parsed.data.mimeType, sizeBytes: bytes.length, checksumSha256, isInternal: parsed.data.isInternal ?? false }).returning();
  await audit(req, "ticket", ticket.id, "attachment_added", null, { attachmentId: created.id, originalName: created.originalName, sizeBytes: created.sizeBytes }, `Attachment added to ${ticket.ticketNumber}`);
  res.status(201).json({ ...created, storageKey: undefined });
});

router.get("/api/attachments/:id/download", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const [file] = await db.select().from(attachments).where(and(eq(attachments.orgId, orgId), eq(attachments.id, routeParam(req, "id"))));
  if (!file) return res.status(404).json({ error: "Attachment not found" });
  if (file.isInternal) {
    const membership = await storage.getMembership(orgId, req.session.userId!);
    if (!membership || !hasRole(membership.role, "technician")) return res.status(403).json({ error: "Internal attachment access denied" });
  }
  const root = path.resolve(process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), "data", "attachments"));
  const target = path.resolve(root, file.storageKey);
  if (!target.startsWith(root + path.sep)) return res.status(400).json({ error: "Invalid storage path" });
  const bytes = await readFile(target);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.originalName.replace(/[\r\n"]/g, "_")}"`);
  res.send(bytes);
});

const queueInput = z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional(), emailAlias: z.string().max(200).nullable().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), isActive: z.boolean().optional() });
router.get("/api/queues", requireAuth, requireOrg, async (req, res) => res.json(await db.select().from(queues).where(eq(queues.orgId, req.session.orgId!)).orderBy(asc(queues.name))));
router.post("/api/queues", requireAuth, requireOrg, requireMinRole("admin"), async (req, res) => {
  const parsed = queueInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid queue", details: parsed.error.flatten() });
  const [created] = await db.insert(queues).values({ ...parsed.data, orgId: req.session.orgId!, name: cleanText(parsed.data.name, 120), description: cleanText(parsed.data.description, 2000) }).returning();
  await audit(req, "queue", created.id, "created", null, created); res.status(201).json(created);
});

const slaInput = z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional(), responseMinutes: z.number().int().min(1).max(525600), resolutionMinutes: z.number().int().min(1).max(525600), businessHours: z.record(z.unknown()).optional(), pauseStatuses: z.array(z.string()).optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional() });
router.get("/api/sla-policies", requireAuth, requireOrg, async (req, res) => res.json(await db.select().from(slaPolicies).where(eq(slaPolicies.orgId, req.session.orgId!)).orderBy(asc(slaPolicies.name))));
router.post("/api/sla-policies", requireAuth, requireOrg, requireMinRole("admin"), async (req, res) => {
  const parsed = slaInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Invalid SLA policy", details: parsed.error.flatten() });
  const [created] = await db.insert(slaPolicies).values({ ...parsed.data, orgId: req.session.orgId!, name: cleanText(parsed.data.name, 120), description: cleanText(parsed.data.description, 2000) }).returning();
  await audit(req, "sla_policy", created.id, "created", null, created); res.status(201).json(created);
});

router.get("/api/knowledge/categories", requireAuth, requireOrg, async (req, res) => res.json(await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.orgId, req.session.orgId!)).orderBy(asc(knowledgeCategories.name))));
router.post("/api/knowledge/categories", requireAuth, requireOrg, requireMinRole("supervisor"), async (req, res) => {
  const name = cleanText(req.body.name, 120); if (!name) return res.status(400).json({ error: "Category name required" });
  const [created] = await db.insert(knowledgeCategories).values({ orgId: req.session.orgId!, name, slug: slugify(req.body.slug || name), description: cleanText(req.body.description, 2000) }).returning();
  await audit(req, "knowledge_category", created.id, "created", null, created); res.status(201).json(created);
});

router.get("/api/knowledge/articles", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!; const q = cleanText(req.query.q, 200); const membership = await storage.getMembership(orgId, req.session.userId!);
  const conditions = [eq(knowledgeArticles.orgId, orgId)];
  if (!membership || !hasRole(membership.role, "technician")) conditions.push(eq(knowledgeArticles.status, "published"));
  if (q) conditions.push(or(ilike(knowledgeArticles.title, `%${q}%`), ilike(knowledgeArticles.summary, `%${q}%`), ilike(knowledgeArticles.body, `%${q}%`))!);
  res.json(await db.select().from(knowledgeArticles).where(and(...conditions)).orderBy(desc(knowledgeArticles.updatedAt)));
});
router.post("/api/knowledge/articles", requireAuth, requireOrg, requireMinRole("supervisor"), async (req, res) => {
  const title = cleanText(req.body.title, 200); const body = cleanText(req.body.body, 200_000);
  if (!title || !body) return res.status(400).json({ error: "Title and body are required" });
  if (req.body.categoryId && !(await pool.query("SELECT 1 FROM knowledge_categories WHERE org_id=$1 AND id=$2", [req.session.orgId, req.body.categoryId])).rowCount) return res.status(400).json({ error: "Category does not belong to tenant" });
  const status = req.body.status === "published" ? "published" : "draft";
  const [created] = await db.insert(knowledgeArticles).values({ orgId: req.session.orgId!, authorId: req.session.userId!, categoryId: req.body.categoryId || null, title, slug: slugify(req.body.slug || title), summary: cleanText(req.body.summary, 2000), body, status, visibility: req.body.visibility === "client" ? "client" : "internal", publishedAt: status === "published" ? new Date() : null }).returning();
  await audit(req, "knowledge_article", created.id, "created", null, created); res.status(201).json(created);
});

router.get("/api/contracts", requireAuth, requireOrg, async (req, res) => {
  res.json(await db.select().from(contracts).where(eq(contracts.orgId, req.session.orgId!)).orderBy(desc(contracts.updatedAt)));
});
router.post("/api/contracts", requireAuth, requireOrg, requireMinRole("supervisor"), async (req, res) => {
  const orgId = req.session.orgId!;
  const name = cleanText(req.body.name, 200);
  if (!name) return res.status(400).json({ error: "Contract name required" });
  if (req.body.clientId && !(await tenantRefExists(orgId, "clients", req.body.clientId))) return res.status(400).json({ error: "Client does not belong to tenant" });
  if (req.body.vendorId && !(await tenantRefExists(orgId, "vendors", req.body.vendorId))) return res.status(400).json({ error: "Vendor does not belong to tenant" });
  const [created] = await db.insert(contracts).values({ orgId, clientId: req.body.clientId || null, vendorId: req.body.vendorId || null, name, contractNumber: cleanText(req.body.contractNumber, 100), status: req.body.status === "expired" ? "expired" : "active", startDate: req.body.startDate ? new Date(req.body.startDate) : null, endDate: req.body.endDate ? new Date(req.body.endDate) : null, renewalDate: req.body.renewalDate ? new Date(req.body.renewalDate) : null, terms: cleanText(req.body.terms, 50_000), notes: cleanText(req.body.notes) }).returning();
  await audit(req, "contract", created.id, "created", null, created); res.status(201).json(created);
});

router.get("/api/assets/:id/devices", requireAuth, requireOrg, async (req, res) => {
  const assetId = routeParam(req, "id");
  if (!(await tenantRefExists(req.session.orgId!, "assets", assetId))) return res.status(404).json({ error: "Asset not found" });
  res.json(await db.select().from(devices).where(and(eq(devices.orgId, req.session.orgId!), eq(devices.assetId, assetId))).orderBy(asc(devices.hostname)));
});
router.post("/api/assets/:id/devices", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!; const assetId = routeParam(req, "id");
  if (!(await tenantRefExists(orgId, "assets", assetId))) return res.status(404).json({ error: "Asset not found" });
  const hostname = cleanText(req.body.hostname, 255); if (!hostname) return res.status(400).json({ error: "Hostname required" });
  const [created] = await db.insert(devices).values({ orgId, assetId, hostname, deviceType: cleanText(req.body.deviceType, 80) || "workstation", operatingSystem: cleanText(req.body.operatingSystem, 255), ipAddress: cleanText(req.body.ipAddress, 80), macAddress: cleanText(req.body.macAddress, 80), manufacturer: cleanText(req.body.manufacturer, 120), model: cleanText(req.body.model, 120), metadata: req.body.metadata ?? {} }).returning();
  await audit(req, "device", created.id, "created", null, created); res.status(201).json(created);
});

router.get("/api/tags", requireAuth, requireOrg, async (req, res) => res.json(await db.select().from(tags).where(eq(tags.orgId, req.session.orgId!)).orderBy(asc(tags.name))));
router.post("/api/tags", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const name = cleanText(req.body.name, 80); if (!name) return res.status(400).json({ error: "Tag name required" });
  const [created] = await db.insert(tags).values({ orgId: req.session.orgId!, name, color: /^#[0-9a-f]{6}$/i.test(req.body.color || "") ? req.body.color : "#64748b" }).returning(); res.status(201).json(created);
});
router.post("/api/tickets/:id/tags", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const orgId = req.session.orgId!; const ticket = await storage.getTicket(orgId, routeParam(req, "id"));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const tagIds = Array.isArray(req.body.tagIds) ? req.body.tagIds.map(String) : [];
  const owned = tagIds.length ? await db.select({ id: tags.id }).from(tags).where(and(eq(tags.orgId, orgId), inArray(tags.id, tagIds))) : [];
  if (owned.length !== tagIds.length) return res.status(400).json({ error: "One or more tags do not belong to tenant" });
  await db.delete(ticketTags).where(and(eq(ticketTags.orgId, orgId), eq(ticketTags.ticketId, ticket.id)));
  if (tagIds.length) await db.insert(ticketTags).values(tagIds.map((tagId: string) => ({ orgId, ticketId: ticket.id, tagId })));
  await audit(req, "ticket", ticket.id, "tags_updated", null, { tagIds }); res.json({ ok: true });
});

router.post("/api/teams/:id/members", requireAuth, requireOrg, requireMinRole("admin"), async (req, res) => {
  const orgId = req.session.orgId!; const teamId = routeParam(req, "id"); const userId = String(req.body.userId || "");
  if (!(await tenantRefExists(orgId, "teams", teamId)) || !(await tenantRefExists(orgId, "users", userId))) return res.status(400).json({ error: "Team or technician does not belong to tenant" });
  const [created] = await db.insert(teamMembers).values({ orgId, teamId, userId, isLead: req.body.isLead === true }).returning(); res.status(201).json(created);
});

router.get("/api/saved-views", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!; const userId = req.session.userId!;
  res.json(await db.select().from(savedViews).where(and(eq(savedViews.orgId, orgId), or(eq(savedViews.userId, userId), eq(savedViews.isShared, true)))).orderBy(asc(savedViews.name)));
});
router.post("/api/saved-views", requireAuth, requireOrg, async (req, res) => {
  const name = cleanText(req.body.name, 120); if (!name) return res.status(400).json({ error: "View name required" });
  const [created] = await db.insert(savedViews).values({ orgId: req.session.orgId!, userId: req.session.userId!, name, resource: "tickets", filters: req.body.filters ?? {}, sort: req.body.sort ?? {}, isShared: req.body.isShared === true }).returning();
  res.status(201).json(created);
});

router.get("/api/service-desk/config", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.session.orgId!;
  const [statuses, priorities, types, categories, queueRows, teamRows, policies] = await Promise.all([
    db.select().from(ticketStatuses).where(eq(ticketStatuses.orgId, orgId)).orderBy(asc(ticketStatuses.sortOrder)),
    db.select().from(ticketPriorities).where(eq(ticketPriorities.orgId, orgId)).orderBy(asc(ticketPriorities.sortOrder)),
    db.select().from(ticketTypes).where(eq(ticketTypes.orgId, orgId)).orderBy(asc(ticketTypes.name)),
    db.select().from(ticketCategories).where(eq(ticketCategories.orgId, orgId)).orderBy(asc(ticketCategories.name)),
    db.select().from(queues).where(eq(queues.orgId, orgId)).orderBy(asc(queues.name)),
    db.select().from(teams).where(eq(teams.orgId, orgId)).orderBy(asc(teams.name)),
    db.select().from(slaPolicies).where(eq(slaPolicies.orgId, orgId)).orderBy(asc(slaPolicies.name)),
  ]);
  res.json({ statuses, priorities, types, categories, queues: queueRows, teams: teamRows, slaPolicies: policies });
});

router.post("/api/service-desk/config/:kind", requireAuth, requireOrg, requireMinRole("admin"), async (req, res) => {
  const orgId = req.session.orgId!;
  const kind = routeParam(req, "kind");
  const name = cleanText(req.body.name, 120);
  const key = slugify(req.body.key || name).replace(/-/g, "_");
  if (!name || !key) return res.status(400).json({ error: "Name and key are required" });
  let created: any;
  if (kind === "statuses") {
    [created] = await db.insert(ticketStatuses).values({ orgId, name, key, color: req.body.color || "#64748b", sortOrder: Number(req.body.sortOrder) || 0, isClosedState: req.body.isClosedState === true, isDefault: req.body.isDefault === true }).returning();
  } else if (kind === "priorities") {
    [created] = await db.insert(ticketPriorities).values({ orgId, name, key, color: req.body.color || "#64748b", sortOrder: Number(req.body.sortOrder) || 0, responseMinutes: Number(req.body.responseMinutes) || null, resolutionMinutes: Number(req.body.resolutionMinutes) || null }).returning();
  } else if (kind === "types") {
    [created] = await db.insert(ticketTypes).values({ orgId, name, key, description: cleanText(req.body.description, 2000) }).returning();
  } else if (kind === "categories") {
    [created] = await db.insert(ticketCategories).values({ orgId, name, key, description: cleanText(req.body.description, 2000), parentId: req.body.parentId || null }).returning();
  } else if (kind === "teams") {
    if (req.body.queueId && !(await tenantRefExists(orgId, "queues", req.body.queueId))) return res.status(400).json({ error: "Queue does not belong to tenant" });
    [created] = await db.insert(teams).values({ orgId, name, description: cleanText(req.body.description, 2000), queueId: req.body.queueId || null }).returning();
  } else {
    return res.status(404).json({ error: "Unknown configuration type" });
  }
  await audit(req, `ticket_${kind}`, created.id, "created", null, created, `${name} created`);
  res.status(201).json(created);
});

router.get("/api/activity", requireAuth, requireOrg, requireMinRole("technician"), async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(await db.select().from(activityEvents).where(eq(activityEvents.orgId, req.session.orgId!)).orderBy(desc(activityEvents.createdAt)).limit(limit));
});

router.get("/api/notification-preferences", requireAuth, requireOrg, async (req, res) => {
  const [row] = await db.select().from(notificationPreferences).where(and(eq(notificationPreferences.orgId, req.session.orgId!), eq(notificationPreferences.userId, req.session.userId!)));
  res.json(row ?? { emailEnabled: true, inAppEnabled: true, eventPreferences: {}, quietHours: {} });
});
router.put("/api/notification-preferences", requireAuth, requireOrg, async (req, res) => {
  const values = { emailEnabled: req.body.emailEnabled !== false, inAppEnabled: req.body.inAppEnabled !== false, eventPreferences: req.body.eventPreferences ?? {}, quietHours: req.body.quietHours ?? {}, updatedAt: new Date() };
  const [existing] = await db.select().from(notificationPreferences).where(and(eq(notificationPreferences.orgId, req.session.orgId!), eq(notificationPreferences.userId, req.session.userId!)));
  const [row] = existing
    ? await db.update(notificationPreferences).set(values).where(eq(notificationPreferences.id, existing.id)).returning()
    : await db.insert(notificationPreferences).values({ ...values, orgId: req.session.orgId!, userId: req.session.userId! }).returning();
  res.json(row);
});

export default router;
