import { Router, type Request, type Response } from "express";
import { requireAuth, requireOrg, requireMinRole, requireFeature, requireSuperAdmin } from "../middleware";
import { storage } from "../storage";
import { db } from "../db";
import { z } from "zod";
import {
  emailSettings,
  emailContacts,
  inboundEmailLog,
  PLAN_LIMITS,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import {
  processInboundEmail,
  getProvider,
  generateAlias,
  type ParsedEmail,
} from "../services/emailProcessor";
import { encryptSecret, decryptSecret } from "../auth/crypto";
import { testImapConnection } from "../services/imapClient";
import {
  startPollerForOrg,
  stopPollerForOrg,
  resetPollerForOrg,
  getPollerStatus,
  getPollerStatusForOrg,
  forcePollForOrg,
  disablePollerForOrg,
} from "../services/imapPoller";

const router = Router();

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function safeError(err: any): string {
  if (process.env.NODE_ENV === "production") return "Internal server error";
  return err?.message || "Unknown error";
}

const ALLOWED_PROVIDERS = new Set(["mock", "sendgrid", "mailgun", "postmark"]);

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultDepartmentId: z.string().uuid().nullable().optional(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  allowedSenderDomains: z.array(z.string().min(1).max(253)).optional(),
  autoCreateContacts: z.boolean().optional(),
  appendRepliesToTickets: z.boolean().optional(),
  unknownSenderAction: z.enum(["create_ticket", "reject"]).optional(),
});

const testInboundSchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().max(200).optional().default(""),
  subject: z.string().min(1).max(500),
  body: z.string().max(10000).optional().default(""),
});

router.get("/api/email/settings", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const org = await storage.getOrg(orgId);
    const plan = ((org as any)?.plan || "free") as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    if (!limits.emailToTicket) {
      return res.json({ eligible: false, plan, settings: null });
    }

    const results = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    const settings = results[0] || null;
    if (settings) {
      const { imapPasswordEncrypted, ...sanitized } = settings;
      return res.json({ eligible: true, plan, settings: { ...sanitized, imapPasswordSet: !!imapPasswordEncrypted } });
    }
    return res.json({ eligible: true, plan, settings: null });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/email/settings/initialize", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const existing = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (existing.length > 0) {
      return res.json(existing[0]);
    }

    const org = await storage.getOrg(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const alias = generateAlias(org.slug);

    const aliasCheck = await db.select().from(emailSettings).where(eq(emailSettings.inboundAlias, alias));
    if (aliasCheck.length > 0) {
      const uniqueAlias = `${alias}-${Date.now().toString(36).slice(-4)}`;
      const [created] = await db.insert(emailSettings).values({
        orgId,
        inboundAlias: uniqueAlias,
      }).returning();
      return res.json(created);
    }

    const [created] = await db.insert(emailSettings).values({
      orgId,
      inboundAlias: alias,
    }).returning();
    return res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

const oauthAppConfigSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  clientId: z.string().min(1).max(500),
  clientSecret: z.string().max(500).optional(),
});

router.get("/api/email/oauth-app-config", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (!settings) return res.json({ googleClientIdSet: false, microsoftClientIdSet: false });
    res.json({
      googleClientIdSet: !!(settings as any).googleClientId,
      googleClientId: (settings as any).googleClientId || null,
      microsoftClientIdSet: !!(settings as any).microsoftClientId,
      microsoftClientId: (settings as any).microsoftClientId || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch("/api/email/oauth-app-config", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = oauthAppConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const [existing] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (!existing) return res.status(400).json({ error: "Email settings not initialized. Set up Connected Inboxes first." });

    const { provider, clientId, clientSecret } = parsed.data;
    const updateData: any = { updatedAt: new Date() };

    if (provider === "google") {
      const hasExistingSecret = !!(existing as any).googleClientSecretEncrypted;
      if (!clientSecret && !hasExistingSecret) {
        return res.status(400).json({ error: "Client secret is required when no secret is currently stored." });
      }
      updateData.googleClientId = clientId;
      if (clientSecret) updateData.googleClientSecretEncrypted = encryptSecret(clientSecret);
    } else if (provider === "microsoft") {
      const hasExistingSecret = !!(existing as any).microsoftClientSecretEncrypted;
      if (!clientSecret && !hasExistingSecret) {
        return res.status(400).json({ error: "Client secret is required when no secret is currently stored." });
      }
      updateData.microsoftClientId = clientId;
      if (clientSecret) updateData.microsoftClientSecretEncrypted = encryptSecret(clientSecret);
    }

    await db.update(emailSettings).set(updateData).where(eq(emailSettings.orgId, orgId));
    res.json({ ok: true, provider, clientIdSet: true });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete("/api/email/oauth-app-config/:provider", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const { provider } = req.params;
    if (provider !== "google" && provider !== "microsoft") {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const [existing] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (!existing) return res.status(404).json({ error: "Email settings not found" });

    const updateData: any = { updatedAt: new Date() };
    if (provider === "google") {
      updateData.googleClientId = null;
      updateData.googleClientSecretEncrypted = null;
    } else {
      updateData.microsoftClientId = null;
      updateData.microsoftClientSecretEncrypted = null;
    }

    await db.update(emailSettings).set(updateData).where(eq(emailSettings.orgId, orgId));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch("/api/email/settings", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const data = parsed.data;
    const updateData: any = { updatedAt: new Date() };

    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.defaultDepartmentId !== undefined) updateData.defaultDepartmentId = data.defaultDepartmentId;
    if (data.defaultAssigneeId !== undefined) updateData.defaultAssigneeId = data.defaultAssigneeId;
    if (data.allowedSenderDomains !== undefined) updateData.allowedSenderDomains = data.allowedSenderDomains;
    if (data.autoCreateContacts !== undefined) updateData.autoCreateContacts = data.autoCreateContacts;
    if (data.appendRepliesToTickets !== undefined) updateData.appendRepliesToTickets = data.appendRepliesToTickets;
    if (data.unknownSenderAction !== undefined) updateData.unknownSenderAction = data.unknownSenderAction;

    const [updated] = await db
      .update(emailSettings)
      .set(updateData)
      .where(eq(emailSettings.orgId, orgId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Email settings not found. Initialize first." });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/email/events", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = await db
      .select({
        id: inboundEmailLog.id,
        fromEmail: inboundEmailLog.fromEmail,
        fromName: inboundEmailLog.fromName,
        subject: inboundEmailLog.subject,
        status: inboundEmailLog.status,
        statusReason: inboundEmailLog.statusReason,
        ticketId: inboundEmailLog.ticketId,
        createdAt: inboundEmailLog.createdAt,
      })
      .from(inboundEmailLog)
      .where(eq(inboundEmailLog.orgId, orgId))
      .orderBy(desc(inboundEmailLog.createdAt))
      .limit(limit);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/email/contacts", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const contacts = await db
      .select()
      .from(emailContacts)
      .where(eq(emailContacts.orgId, orgId))
      .orderBy(desc(emailContacts.createdAt));
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/email/inbound/:provider", async (req: Request, res: Response) => {
  try {
    const providerName = req.params.provider;

    if (!providerName || !ALLOWED_PROVIDERS.has(providerName)) {
      return res.status(400).json({ error: "Unsupported provider" });
    }

    if (providerName === "mock" && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Mock provider disabled in production" });
    }

    const provider = getProvider(providerName);

    const headerObj: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") headerObj[key] = val;
    }

    if (!provider.verifySignature(req.body, headerObj)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const clientKey = req.ip || "unknown";
    if (!checkRateLimit(clientKey)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    const email = provider.parseWebhook(req.body, headerObj);
    const result = await processInboundEmail(email);
    res.json(result);
  } catch (err: any) {
    console.error("[email/inbound] Error processing webhook:", err.message);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
});

router.post("/api/email/test-inbound", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const settings = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (settings.length === 0) {
      return res.status(400).json({ error: "Email settings not initialized" });
    }

    const parsed = testInboundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const { fromEmail, fromName, subject, body } = parsed.data;

    const testEmail: ParsedEmail = {
      messageId: `<test-${Date.now()}@pulsedesk.support>`,
      from: { email: fromEmail, name: fromName },
      to: `${settings[0].inboundAlias}@pulsedesk.support`,
      subject,
      bodyPlain: body || subject,
      bodyHtml: "",
      provider: "mock",
    };

    const result = await processInboundEmail(testEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/email/settings", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allSettings = await db
      .select({
        id: emailSettings.id,
        orgId: emailSettings.orgId,
        inboundAlias: emailSettings.inboundAlias,
        enabled: emailSettings.enabled,
        createdAt: emailSettings.createdAt,
        updatedAt: emailSettings.updatedAt,
      })
      .from(emailSettings)
      .orderBy(desc(emailSettings.createdAt));

    const enriched = await Promise.all(
      allSettings.map(async (s) => {
        const org = await storage.getOrg(s.orgId);
        return { ...s, orgName: org?.name || "Unknown", orgPlan: (org as any)?.plan || "free" };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/email/events", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const events = await db
      .select({
        id: inboundEmailLog.id,
        orgId: inboundEmailLog.orgId,
        fromEmail: inboundEmailLog.fromEmail,
        fromName: inboundEmailLog.fromName,
        subject: inboundEmailLog.subject,
        status: inboundEmailLog.status,
        statusReason: inboundEmailLog.statusReason,
        ticketId: inboundEmailLog.ticketId,
        provider: inboundEmailLog.provider,
        createdAt: inboundEmailLog.createdAt,
      })
      .from(inboundEmailLog)
      .orderBy(desc(inboundEmailLog.createdAt))
      .limit(limit);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/email/toggle/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { enabled } = req.body;

    const [updated] = await db
      .update(emailSettings)
      .set({ enabled: !!enabled, updatedAt: new Date() })
      .where(eq(emailSettings.orgId, orgId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Settings not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/email/regenerate-alias/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const org = await storage.getOrg(orgId);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const newAlias = `${generateAlias(org.slug)}-${Date.now().toString(36).slice(-4)}`;

    const [updated] = await db
      .update(emailSettings)
      .set({ inboundAlias: newAlias, updatedAt: new Date() })
      .where(eq(emailSettings.orgId, orgId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Settings not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/email/outbound/status", requireAuth, requireOrg, async (_req: Request, res: Response) => {
  const { isOutboundEnabled } = await import("../email/outbound");
  res.json({ enabled: isOutboundEnabled() });
});

router.post("/api/email/outbound/test", requireAuth, requireOrg, requireMinRole("admin"), async (req: Request, res: Response) => {
  try {
    const { to } = req.body as { to?: string };
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: "Valid recipient email required" });
    }
    const { isOutboundEnabled, sendOutbound } = await import("../email/outbound");
    if (!isOutboundEnabled()) {
      return res.status(503).json({ error: "Outbound email not configured. Set SENDGRID_API_KEY in environment." });
    }
    const result = await sendOutbound({
      to,
      subject: "PulseDesk test email",
      text: "This is a test from your PulseDesk outbound mailer. If you received this, SendGrid is wired up correctly.",
      html: `<p>This is a <strong>test</strong> from your PulseDesk outbound mailer. If you received this, SendGrid is wired up correctly.</p>`,
    });
    if (!result.ok) return res.status(502).json({ error: result.reason });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/email/failed", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const events = await storage.getFailedInboundEmails(50);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/email/replay/:eventId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const [event] = await db.select().from(inboundEmailLog).where(eq(inboundEmailLog.id, eventId));
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.status !== "failed") return res.status(400).json({ error: "Only failed events can be replayed" });

    const email: ParsedEmail = {
      messageId: event.messageId || undefined,
      from: { email: event.fromEmail, name: event.fromName || "" },
      to: event.toAddress,
      subject: event.subject || "",
      bodyPlain: event.bodyPlain || "",
      bodyHtml: event.bodyHtml || "",
      inReplyTo: event.inReplyTo || undefined,
      references: (event as any).references || undefined,
      headers: (event.headers as any) || {},
      provider: event.provider || "mock",
    };

    const result = await processInboundEmail(email);
    res.json({ replayed: true, result });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

const imapConfigSchema = z.object({
  imapHost: z.string().min(1).max(253),
  imapPort: z.number().int().min(1).max(65535).optional().default(993),
  imapUser: z.string().min(1).max(253),
  imapPassword: z.string().max(500).optional(),
  imapTls: z.boolean().optional().default(true),
  imapPollIntervalSeconds: z.number().int().min(60).max(3600).optional().default(120),
  imapFolder: z.string().min(1).max(253).optional().default("INBOX"),
});

const imapUpdateSchema = z.object({
  imapEnabled: z.boolean().optional(),
  imapHost: z.string().min(1).max(253).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().min(1).max(253).optional(),
  imapPassword: z.string().min(1).max(500).optional(),
  imapTls: z.boolean().optional(),
  imapPollIntervalSeconds: z.number().int().min(60).max(3600).optional(),
  imapFolder: z.string().min(1).max(253).optional(),
});

router.get("/api/email/imap/status", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (!settings) return res.json({ configured: false });

    const pollerStatus = getPollerStatusForOrg(orgId);

    res.json({
      configured: !!(settings.imapHost && settings.imapUser && settings.imapPasswordEncrypted),
      imapHost: settings.imapHost || null,
      imapPort: settings.imapPort || 993,
      imapUser: settings.imapUser || null,
      imapTls: settings.imapTls,
      imapEnabled: settings.imapEnabled,
      imapPollIntervalSeconds: settings.imapPollIntervalSeconds || 120,
      imapFolder: settings.imapFolder || "INBOX",
      imapLastPolledAt: settings.imapLastPolledAt,
      imapLastError: settings.imapLastError,
      imapConsecutiveFailures: settings.imapConsecutiveFailures,
      imapEmailsProcessed: settings.imapEmailsProcessed || 0,
      pollerRunning: pollerStatus?.running || false,
      pollerDisabled: pollerStatus?.disabled || false,
    });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/email/imap/configure", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = imapConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const existing = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
    if (existing.length === 0) {
      return res.status(400).json({ error: "Email settings not initialized. Activate Email-to-Ticket first." });
    }

    const { imapHost, imapPort, imapUser, imapPassword, imapTls, imapPollIntervalSeconds, imapFolder } = parsed.data;

    const existingSettings = existing[0];
    if (!imapPassword && !existingSettings.imapPasswordEncrypted) {
      return res.status(400).json({ error: "IMAP password is required for initial configuration" });
    }

    const updateData: any = {
      imapHost,
      imapPort,
      imapUser,
      imapTls,
      imapPollIntervalSeconds,
      imapFolder: imapFolder || "INBOX",
      imapConsecutiveFailures: 0,
      imapLastError: null,
      updatedAt: new Date(),
    };

    if (imapPassword) {
      updateData.imapPasswordEncrypted = encryptSecret(imapPassword);
    }

    const [updated] = await db.update(emailSettings).set(updateData).where(eq(emailSettings.orgId, orgId)).returning();

    res.json({
      configured: true,
      imapHost: updated.imapHost,
      imapPort: updated.imapPort,
      imapUser: updated.imapUser,
      imapTls: updated.imapTls,
      imapEnabled: updated.imapEnabled,
      imapPollIntervalSeconds: updated.imapPollIntervalSeconds,
      imapFolder: updated.imapFolder,
    });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch("/api/email/imap", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = imapUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const data = parsed.data;
    const updateData: any = { updatedAt: new Date() };

    if (data.imapHost !== undefined) updateData.imapHost = data.imapHost;
    if (data.imapPort !== undefined) updateData.imapPort = data.imapPort;
    if (data.imapUser !== undefined) updateData.imapUser = data.imapUser;
    if (data.imapTls !== undefined) updateData.imapTls = data.imapTls;
    if (data.imapPollIntervalSeconds !== undefined) updateData.imapPollIntervalSeconds = data.imapPollIntervalSeconds;
    if (data.imapFolder !== undefined) updateData.imapFolder = data.imapFolder;

    if (data.imapPassword !== undefined) {
      updateData.imapPasswordEncrypted = encryptSecret(data.imapPassword);
      updateData.imapConsecutiveFailures = 0;
      updateData.imapLastError = null;
    }

    if (data.imapEnabled !== undefined) {
      updateData.imapEnabled = data.imapEnabled;

      if (data.imapEnabled) {
        const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
        if (!settings?.imapHost || !settings?.imapUser || !settings?.imapPasswordEncrypted) {
          return res.status(400).json({ error: "Configure IMAP credentials before enabling polling" });
        }
      }
    }

    const [updated] = await db.update(emailSettings)
      .set(updateData)
      .where(eq(emailSettings.orgId, orgId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Email settings not found" });

    if (data.imapEnabled === true && updated.imapHost && updated.imapUser && updated.imapPasswordEncrypted) {
      startPollerForOrg(orgId, updated);
    } else if (data.imapEnabled === false) {
      stopPollerForOrg(orgId);
    }

    res.json({
      imapHost: updated.imapHost,
      imapPort: updated.imapPort,
      imapUser: updated.imapUser,
      imapTls: updated.imapTls,
      imapEnabled: updated.imapEnabled,
      imapPollIntervalSeconds: updated.imapPollIntervalSeconds,
      imapLastPolledAt: updated.imapLastPolledAt,
      imapLastError: updated.imapLastError,
      imapConsecutiveFailures: updated.imapConsecutiveFailures,
    });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/email/imap/test", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;

    const bodyParsed = z.object({
      imapHost: z.string().min(1),
      imapPort: z.number().int().min(1).max(65535).optional().default(993),
      imapUser: z.string().min(1),
      imapPassword: z.string().min(1).optional(),
      imapTls: z.boolean().optional().default(true),
    }).safeParse(req.body);

    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Validation failed", details: bodyParsed.error.flatten().fieldErrors });
    }

    const { imapHost, imapPort, imapUser, imapTls } = bodyParsed.data;
    let password = bodyParsed.data.imapPassword;

    if (!password) {
      const [settings] = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
      if (!settings?.imapPasswordEncrypted) {
        return res.status(400).json({ error: "No password provided and no saved password found" });
      }
      if (settings.imapHost !== imapHost || settings.imapUser !== imapUser) {
        return res.status(400).json({ error: "Password is required when testing with different host or user than saved config" });
      }
      try {
        password = decryptSecret(settings.imapPasswordEncrypted);
      } catch {
        return res.status(400).json({ error: "Failed to decrypt saved password" });
      }
    }

    const result = await testImapConnection({
      host: imapHost,
      port: imapPort,
      user: imapUser,
      password,
      tls: imapTls,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/email/imap/reset", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    await resetPollerForOrg(orgId);
    res.json({ success: true, message: "Poller reset and restarted" });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/imap/status", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const pollerStatuses = getPollerStatus();

    const allImapSettings = await db
      .select({
        orgId: emailSettings.orgId,
        imapHost: emailSettings.imapHost,
        imapUser: emailSettings.imapUser,
        imapEnabled: emailSettings.imapEnabled,
        imapLastPolledAt: emailSettings.imapLastPolledAt,
        imapLastError: emailSettings.imapLastError,
        imapConsecutiveFailures: emailSettings.imapConsecutiveFailures,
        imapEmailsProcessed: emailSettings.imapEmailsProcessed,
      })
      .from(emailSettings)
      .where(eq(emailSettings.imapEnabled, true));

    const settingsMap = new Map(allImapSettings.map(s => [s.orgId, s]));

    const enriched = await Promise.all(
      pollerStatuses.map(async (p) => {
        const org = await storage.getOrg(p.orgId);
        const dbSettings = settingsMap.get(p.orgId);
        return {
          ...p,
          imapEmailsProcessed: dbSettings?.imapEmailsProcessed || 0,
          orgName: org?.name || "Unknown",
          orgPlan: (org as any)?.plan || "free",
        };
      })
    );

    const activeOrgIds = new Set(pollerStatuses.map(p => p.orgId));
    const dbOnly = [];
    for (const s of allImapSettings) {
      if (!activeOrgIds.has(s.orgId)) {
        const org = await storage.getOrg(s.orgId);
        dbOnly.push({
          orgId: s.orgId,
          running: false,
          lastPollAt: s.imapLastPolledAt,
          lastError: s.imapLastError,
          consecutiveFailures: s.imapConsecutiveFailures,
          imapEmailsProcessed: s.imapEmailsProcessed || 0,
          disabled: true,
          orgName: org?.name || "Unknown",
          orgPlan: (org as any)?.plan || "free",
        });
      }
    }

    res.json({ pollers: enriched, dbOnlyEnabled: dbOnly });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/imap/reset/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    await resetPollerForOrg(orgId);
    res.json({ success: true, message: `Poller reset for org ${orgId}` });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/imap/force-poll/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await forcePollForOrg(orgId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: `Force poll completed for org ${orgId}` });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/imap/disable/:orgId", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    await disablePollerForOrg(orgId);
    res.json({ success: true, message: `IMAP disabled for org ${orgId}` });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
