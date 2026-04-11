import { db } from "../db";
import { storage } from "../storage";
import {
  emailSettings,
  emailContacts,
  inboundEmailLog,
  ticketEmailMetadata,
  tickets,
  ticketEvents,
  PLAN_LIMITS,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface ParsedEmail {
  messageId?: string;
  from: { email: string; name?: string };
  to: string;
  subject: string;
  bodyPlain: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; size: number; contentType: string }[];
  spf?: string;
  dkim?: string;
  dmarc?: string;
  provider?: string;
}

export interface ProcessingResult {
  status: "created" | "threaded" | "rejected" | "failed";
  reason: string;
  ticketId?: string;
  ticketNumber?: string;
  logId?: string;
}

export interface InboundEmailProvider {
  name: string;
  parseWebhook(body: any, headers: Record<string, string>): ParsedEmail;
  verifySignature(body: any, headers: Record<string, string>): boolean;
}

export class MockEmailProvider implements InboundEmailProvider {
  name = "mock";

  parseWebhook(body: any): ParsedEmail {
    return {
      messageId: body.messageId || `<mock-${Date.now()}@pulsedesk.support>`,
      from: { email: body.fromEmail || body.from, name: body.fromName || "" },
      to: body.to || body.toAddress || "",
      subject: body.subject || "(no subject)",
      bodyPlain: body.bodyPlain || body.body || "",
      bodyHtml: body.bodyHtml || "",
      inReplyTo: body.inReplyTo || undefined,
      references: body.references || undefined,
      headers: body.headers || {},
      attachments: body.attachments || [],
      spf: body.spf || undefined,
      dkim: body.dkim || undefined,
      dmarc: body.dmarc || undefined,
      provider: "mock",
    };
  }

  verifySignature(): boolean {
    return true;
  }
}

const providers: Record<string, InboundEmailProvider> = {
  mock: new MockEmailProvider(),
};

export function getProvider(name: string): InboundEmailProvider {
  return providers[name] || providers.mock;
}

export function registerProvider(provider: InboundEmailProvider) {
  providers[provider.name] = provider;
}

export async function resolveAlias(toAddress: string): Promise<{
  orgId: string;
  settings: any;
} | null> {
  const alias = toAddress.toLowerCase().trim();
  const parts = alias.split("@");
  const localPart = parts[0];

  const results = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.inboundAlias, localPart));

  if (results.length === 0) return null;

  const settings = results[0];
  return { orgId: settings.orgId, settings };
}

function stripEmailSignatureAndQuotes(text: string): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    if (/^--\s*$/.test(line)) break;
    if (/^On .+ wrote:$/.test(line.trim())) break;
    if (/^>/.test(line.trim())) continue;
    if (/^_{3,}$/.test(line.trim())) break;
    if (/^-{3,}$/.test(line.trim()) && cleaned.length > 2) break;
    if (/^From:.*@/.test(line.trim())) break;
    if (/^Sent:/.test(line.trim())) break;
    cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "data-blocked:");
}

function extractTicketToken(subject: string): string | null {
  const match = subject.match(/\[PD-(\d+)\]/);
  return match ? `PD-${match[1]}` : null;
}

export async function processInboundEmail(email: ParsedEmail, connectorId?: string): Promise<ProcessingResult> {
  const aliasResult = await resolveAlias(email.to);

  if (!aliasResult) {
    const logId = await logInboundEmail(null, email, "rejected", "Unknown alias: " + email.to, undefined, connectorId);
    return { status: "rejected", reason: "Unknown alias", logId };
  }

  const { orgId, settings } = aliasResult;

  if (!settings.enabled) {
    const logId = await logInboundEmail(orgId, email, "rejected", "Email-to-ticket disabled for this organization", undefined, connectorId);
    return { status: "rejected", reason: "Feature disabled", logId };
  }

  const org = await storage.getOrg(orgId);
  if (!org) {
    const logId = await logInboundEmail(orgId, email, "rejected", "Organization not found", undefined, connectorId);
    return { status: "rejected", reason: "Organization not found", logId };
  }

  const plan = (org as any).plan || "free";
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
  if (!limits.emailToTicket) {
    const logId = await logInboundEmail(orgId, email, "rejected", "Plan does not include email-to-ticket", undefined, connectorId);
    return { status: "rejected", reason: "Plan not eligible", logId };
  }

  if (settings.allowedSenderDomains && settings.allowedSenderDomains.length > 0) {
    const senderDomain = email.from.email.split("@")[1]?.toLowerCase();
    const allowed = settings.allowedSenderDomains.map((d: string) => d.toLowerCase());
    if (!allowed.includes(senderDomain)) {
      const logId = await logInboundEmail(orgId, email, "rejected", `Sender domain '${senderDomain}' not in allowlist`, undefined, connectorId);
      return { status: "rejected", reason: "Sender domain not allowed", logId };
    }
  }

  try {
    const existingTicket = await findExistingThread(orgId, email);

    if (existingTicket && settings.appendRepliesToTickets) {
      const cleanBody = stripEmailSignatureAndQuotes(email.bodyPlain);
      await storage.createTicketEvent(
        orgId,
        existingTicket.id,
        "email_reply",
        `Email reply from ${email.from.name || email.from.email}:\n\n${cleanBody}`,
        null
      );

      await db.insert(ticketEmailMetadata).values({
        ticketId: existingTicket.id,
        orgId,
        messageId: email.messageId || null,
        inReplyTo: email.inReplyTo || null,
        referencesHeader: email.references || null,
        fromEmail: email.from.email,
        fromName: email.from.name || "",
        originalSubject: email.subject,
      });

      const logId = await logInboundEmail(orgId, email, "threaded", `Appended to ticket ${existingTicket.ticketNumber}`, existingTicket.id, connectorId);
      return { status: "threaded", reason: `Reply appended to ${existingTicket.ticketNumber}`, ticketId: existingTicket.id, ticketNumber: existingTicket.ticketNumber, logId };
    }

    if (settings.unknownSenderAction === "reject") {
      const existingContact = await db
        .select()
        .from(emailContacts)
        .where(and(eq(emailContacts.orgId, orgId), eq(emailContacts.email, email.from.email.toLowerCase())));
      if (existingContact.length === 0) {
        const logId = await logInboundEmail(orgId, email, "rejected", "Unknown sender and unknownSenderAction=reject", undefined, connectorId);
        return { status: "rejected", reason: "Unknown sender", logId };
      }
    }

    let contactId: string | null = null;
    if (settings.autoCreateContacts) {
      const existing = await db
        .select()
        .from(emailContacts)
        .where(and(eq(emailContacts.orgId, orgId), eq(emailContacts.email, email.from.email.toLowerCase())));
      if (existing.length > 0) {
        contactId = existing[0].id;
      } else {
        const [newContact] = await db.insert(emailContacts).values({
          orgId,
          email: email.from.email.toLowerCase(),
          name: email.from.name || "",
        }).returning();
        contactId = newContact.id;
      }
    }

    const ticketNumber = await storage.getNextTicketNumber(orgId);
    const cleanBody = stripEmailSignatureAndQuotes(email.bodyPlain);

    const [newTicket] = await db.insert(tickets).values({
      orgId,
      ticketNumber,
      title: email.subject || "(no subject)",
      description: cleanBody,
      source: "email",
      category: "other",
      priority: "normal",
      status: "new",
      departmentId: settings.defaultDepartmentId || null,
      assignedTo: settings.defaultAssigneeId || null,
    }).returning();

    await storage.createTicketEvent(
      orgId,
      newTicket.id,
      "ticket_created",
      `Ticket created from inbound email from ${email.from.name || email.from.email}`,
      null
    );

    await db.insert(ticketEmailMetadata).values({
      ticketId: newTicket.id,
      orgId,
      messageId: email.messageId || null,
      inReplyTo: email.inReplyTo || null,
      referencesHeader: email.references || null,
      fromEmail: email.from.email,
      fromName: email.from.name || "",
      originalSubject: email.subject,
      contactId,
    });

    const logId = await logInboundEmail(orgId, email, "created", `Created ticket ${ticketNumber}`, newTicket.id, connectorId);
    return { status: "created", reason: `Ticket ${ticketNumber} created`, ticketId: newTicket.id, ticketNumber, logId };
  } catch (err: any) {
    const logId = await logInboundEmail(orgId, email, "failed", err.message || "Processing error", undefined, connectorId);
    return { status: "failed", reason: err.message || "Processing error", logId };
  }
}

async function findExistingThread(orgId: string, email: ParsedEmail): Promise<{ id: string; ticketNumber: string } | null> {
  if (email.inReplyTo) {
    const byInReplyTo = await db
      .select({ ticketId: ticketEmailMetadata.ticketId })
      .from(ticketEmailMetadata)
      .where(and(eq(ticketEmailMetadata.orgId, orgId), eq(ticketEmailMetadata.messageId, email.inReplyTo)));
    if (byInReplyTo.length > 0) {
      const ticket = await db.select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
        .from(tickets)
        .where(and(eq(tickets.id, byInReplyTo[0].ticketId), eq(tickets.orgId, orgId)));
      if (ticket.length > 0) return ticket[0];
    }
  }

  if (email.references) {
    const refs = email.references.split(/\s+/).filter(Boolean);
    for (const ref of refs) {
      const byRef = await db
        .select({ ticketId: ticketEmailMetadata.ticketId })
        .from(ticketEmailMetadata)
        .where(and(eq(ticketEmailMetadata.orgId, orgId), eq(ticketEmailMetadata.messageId, ref)));
      if (byRef.length > 0) {
        const ticket = await db.select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
          .from(tickets)
          .where(and(eq(tickets.id, byRef[0].ticketId), eq(tickets.orgId, orgId)));
        if (ticket.length > 0) return ticket[0];
      }
    }
  }

  const token = extractTicketToken(email.subject);
  if (token) {
    const byToken = await db.select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.ticketNumber, token)));
    if (byToken.length > 0) return byToken[0];
  }

  return null;
}

async function logInboundEmail(
  orgId: string | null,
  email: ParsedEmail,
  status: "accepted" | "rejected" | "failed" | "threaded" | "created",
  reason: string,
  ticketId?: string,
  connectorId?: string
): Promise<string> {
  const [log] = await db.insert(inboundEmailLog).values({
    orgId,
    messageId: email.messageId || null,
    fromEmail: email.from.email,
    fromName: email.from.name || "",
    toAddress: email.to,
    subject: email.subject,
    bodyPlain: email.bodyPlain.substring(0, 10000),
    bodyHtml: sanitizeHtml(email.bodyHtml || "").substring(0, 50000),
    inReplyTo: email.inReplyTo || null,
    references: email.references || null,
    headers: email.headers || {},
    attachmentCount: email.attachments?.length || 0,
    spfResult: email.spf || null,
    dkimResult: email.dkim || null,
    dmarcResult: email.dmarc || null,
    status,
    statusReason: reason,
    ticketId: ticketId || null,
    provider: email.provider || "mock",
    connectorId: connectorId || null,
  }).returning();
  return log.id;
}

export function generateAlias(slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 40);
  return `support+${clean}`;
}
