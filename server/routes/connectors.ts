import { Router, type Request, type Response } from "express";
import { requireAuth, requireOrg, requireMinRole, requireFeature, requireSuperAdmin } from "../middleware";
import { db } from "../db";
import { z } from "zod";
import { mailConnectors, connectorEvents, emailSettings, orgs } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../auth/crypto";
import { getConnectorService } from "../services/connectors/registry";
import type { ConnectorCredentials, ConnectorProvider } from "../services/connectors/types";
import { storage } from "../storage";

type ConnectorEventType = "poll_success" | "poll_error" | "auth_success" | "auth_error" | "disabled" | "enabled" | "config_changed";
import {
  startPollerForConnector,
  stopPollerForConnector,
  getConnectorPollerStatusById,
  getConnectorPollerStatus,
  forcePollConnector,
} from "../services/connectorPoller";

const router = Router();

function getBaseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0]}`;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost:5000";
  return `${protocol}://${host}`;
}

function safeError(err: any): string {
  if (process.env.NODE_ENV === "production") return "Internal server error";
  return err?.message || "Unknown error";
}

function decryptCredentials(encrypted: string): ConnectorCredentials {
  const json = decryptSecret(encrypted);
  return JSON.parse(json);
}

function sanitizeConnector(c: any) {
  const { credentialsEncrypted, ...rest } = c;
  return { ...rest, hasCredentials: !!credentialsEncrypted };
}

function connectorByIdAndOrg(id: string | string[], orgId: string) {
  const connId = Array.isArray(id) ? id[0] : id;
  return sql`${mailConnectors.id} = ${connId} AND ${mailConnectors.orgId} = ${orgId}`;
}

function connectorById(id: string | string[]) {
  const connId = Array.isArray(id) ? id[0] : id;
  return sql`${mailConnectors.id} = ${connId}`;
}

const createConnectorSchema = z.object({
  provider: z.enum(["google", "microsoft", "imap", "forwarding"]),
  label: z.string().max(200).optional().default(""),
  emailAddress: z.string().email().optional(),
  imapHost: z.string().min(1).max(253).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapTls: z.boolean().optional(),
  imapFolder: z.string().min(1).max(253).optional(),
  imapUser: z.string().min(1).max(253).optional(),
  imapPassword: z.string().max(500).optional(),
  pollIntervalSeconds: z.number().int().min(60).max(3600).optional(),
});

const updateConnectorSchema = z.object({
  label: z.string().max(200).optional(),
  emailAddress: z.string().email().optional(),
  imapHost: z.string().min(1).max(253).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapTls: z.boolean().optional(),
  imapFolder: z.string().min(1).max(253).optional(),
  imapUser: z.string().min(1).max(253).optional(),
  imapPassword: z.string().max(500).optional(),
  pollIntervalSeconds: z.number().int().min(60).max(3600).optional(),
  enabled: z.boolean().optional(),
});

router.get("/api/connectors", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const connectors = await db.select().from(mailConnectors).where(sql`${mailConnectors.orgId} = ${orgId}`).orderBy(desc(mailConnectors.createdAt));
    res.json(connectors.map(sanitizeConnector));
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/connectors/:id", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });

    const pollerStatus = getConnectorPollerStatusById(connector.id);
    res.json({ ...sanitizeConnector(connector), pollerRunning: pollerStatus?.running || false });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/connectors", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = createConnectorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const data = parsed.data;
    const insertData: any = {
      orgId,
      provider: data.provider,
      label: data.label || "",
      emailAddress: data.emailAddress || null,
      imapHost: data.imapHost || null,
      imapPort: data.imapPort || 993,
      imapTls: data.imapTls !== undefined ? data.imapTls : true,
      imapFolder: data.imapFolder || "INBOX",
      pollIntervalSeconds: data.pollIntervalSeconds || 120,
    };

    if (data.provider === "imap") {
      if (!data.imapHost || !data.imapUser || !data.imapPassword) {
        return res.status(400).json({ error: "IMAP connectors require imapHost, imapUser, and imapPassword" });
      }
      insertData.credentialsEncrypted = encryptSecret(JSON.stringify({
        imapUser: data.imapUser,
        imapPassword: data.imapPassword,
      }));
      insertData.emailAddress = data.emailAddress || data.imapUser;
      insertData.status = "active";
    } else if (data.provider === "forwarding") {
      insertData.status = "active";
    } else {
      insertData.status = "pending_auth";
    }

    const [created] = await db.insert(mailConnectors).values(insertData).returning();

    if (created.status === "active" && created.provider !== "forwarding") {
      startPollerForConnector(created);
    }

    await logEvent(created.id, orgId, "config_changed", `Connector created: ${data.provider}`);
    res.status(201).json(sanitizeConnector(created));
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch("/api/connectors/:id", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const parsed = updateConnectorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    }

    const [existing] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!existing) return res.status(404).json({ error: "Connector not found" });

    const data = parsed.data;
    const updateData: any = { updatedAt: new Date() };

    if (data.label !== undefined) updateData.label = data.label;
    if (data.emailAddress !== undefined) updateData.emailAddress = data.emailAddress;
    if (data.imapHost !== undefined) updateData.imapHost = data.imapHost;
    if (data.imapPort !== undefined) updateData.imapPort = data.imapPort;
    if (data.imapTls !== undefined) updateData.imapTls = data.imapTls;
    if (data.imapFolder !== undefined) updateData.imapFolder = data.imapFolder;
    if (data.pollIntervalSeconds !== undefined) updateData.pollIntervalSeconds = data.pollIntervalSeconds;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    if (data.imapUser || data.imapPassword) {
      let currentCreds: ConnectorCredentials = {};
      if (existing.credentialsEncrypted) {
        try { currentCreds = decryptCredentials(existing.credentialsEncrypted); } catch {}
      }
      if (data.imapUser) currentCreds.imapUser = data.imapUser;
      if (data.imapPassword) currentCreds.imapPassword = data.imapPassword;
      updateData.credentialsEncrypted = encryptSecret(JSON.stringify(currentCreds));
    }

    if (data.enabled === false) {
      stopPollerForConnector(existing.id);
    }

    const [updated] = await db.update(mailConnectors).set(updateData)
      .where(connectorByIdAndOrg(req.params.id, orgId)).returning();

    if (updated.enabled && updated.status === "active" && updated.provider !== "forwarding") {
      startPollerForConnector(updated);
    }

    await logEvent(updated.id, orgId, "config_changed", "Connector updated");
    res.json(sanitizeConnector(updated));
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete("/api/connectors/:id", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [existing] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!existing) return res.status(404).json({ error: "Connector not found" });

    stopPollerForConnector(existing.id);

    await db.execute(sql`UPDATE inbound_email_log SET connector_id = NULL WHERE connector_id = ${existing.id}`);
    await db.delete(connectorEvents).where(sql`${connectorEvents.connectorId} = ${existing.id}`);
    await db.delete(mailConnectors).where(connectorById(existing.id));

    res.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: safeError({ message }) });
  }
});

router.post("/api/connectors/:id/disconnect", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });

    stopPollerForConnector(connector.id);

    let revokeError: string | undefined;
    if (connector.credentialsEncrypted) {
      try {
        const creds: ConnectorCredentials = JSON.parse(decryptSecret(connector.credentialsEncrypted));
        const service = getConnectorService(connector.provider as ConnectorProvider);
        if (service.disconnect) {
          const result = await service.disconnect(connector, creds);
          if (!result.success) {
            revokeError = result.error;
          }
        }
      } catch (rErr: unknown) {
        revokeError = rErr instanceof Error ? rErr.message : "Unknown revocation error";
        console.error("[connectors] Provider token revocation failed:", revokeError);
      }
    }

    await db.update(mailConnectors).set({
      credentialsEncrypted: null,
      status: "pending_auth",
      enabled: false,
      lastError: null,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    }).where(connectorById(connector.id));

    const eventMessage = revokeError
      ? `Connector disconnected (provider revocation warning: ${revokeError})`
      : "Connector disconnected and credentials revoked";

    await db.insert(connectorEvents).values({
      connectorId: connector.id,
      orgId,
      eventType: "disabled" as ConnectorEventType,
      message: eventMessage,
    });

    res.json({ disconnected: true, revokeWarning: revokeError || undefined });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: safeError({ message }) });
  }
});

router.post("/api/connectors/:id/test", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    if (!connector.credentialsEncrypted) return res.status(400).json({ error: "No credentials configured" });

    const credentials = decryptCredentials(connector.credentialsEncrypted);
    const service = getConnectorService(connector.provider as ConnectorProvider);
    const result = await service.testConnection(connector, credentials);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/connectors/:id/health", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });

    const service = getConnectorService(connector.provider as ConnectorProvider);
    const health = service.getHealth(connector);
    const pollerStatus = getConnectorPollerStatusById(connector.id);

    res.json({
      ...health,
      pollerRunning: pollerStatus?.running || false,
      pollerDisabled: pollerStatus?.disabled || false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: safeError({ message }) });
  }
});

router.post("/api/connectors/:id/poll", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });

    const result = await forcePollConnector(connector.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/connectors/:id/events", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = await db.select().from(connectorEvents)
      .where(sql`${connectorEvents.connectorId} = ${req.params.id} AND ${connectorEvents.orgId} = ${orgId}`)
      .orderBy(desc(connectorEvents.createdAt))
      .limit(limit);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/connectors/:id/oauth/start", requireAuth, requireOrg, requireMinRole("admin"), requireFeature("emailToTicket"), async (req: Request, res: Response) => {
  try {
    const orgId = req.session.orgId!;
    const [connector] = await db.select().from(mailConnectors)
      .where(connectorByIdAndOrg(req.params.id, orgId));
    if (!connector) return res.status(404).json({ error: "Connector not found" });

    if (connector.provider !== "google" && connector.provider !== "microsoft") {
      return res.status(400).json({ error: "OAuth not supported for this provider" });
    }

    const service = getConnectorService(connector.provider as ConnectorProvider);
    if (!service.startOAuth) {
      return res.status(400).json({ error: "OAuth not available for this provider" });
    }

    const redirectUri = `${getBaseUrl(req)}/api/connectors/oauth/callback`;

    const result = await service.startOAuth(connector, redirectUri);

    const sess = req.session as Record<string, unknown>;
    sess.connectorOAuthState = result.state;
    sess.connectorOAuthId = connector.id;
    sess.connectorOAuthProvider = connector.provider;

    res.json({ redirectUrl: result.redirectUrl });
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/connectors/oauth/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/settings/email?connectorError=${encodeURIComponent(error)}`);
    }

    const callbackSession = req.session as Record<string, unknown>;
    const savedState = callbackSession.connectorOAuthState as string | undefined;
    const connectorId = callbackSession.connectorOAuthId as string | undefined;
    const provider = callbackSession.connectorOAuthProvider as string | undefined;

    if (!savedState || !connectorId || !provider) {
      return res.redirect("/settings/email?connectorError=Invalid+session");
    }

    if (state !== savedState) {
      return res.redirect("/settings/email?connectorError=State+mismatch");
    }

    delete callbackSession.connectorOAuthState;
    delete callbackSession.connectorOAuthId;
    delete callbackSession.connectorOAuthProvider;

    const [connector] = await db.select().from(mailConnectors).where(connectorById(connectorId));
    if (!connector) {
      return res.redirect("/settings/email?connectorError=Connector+not+found");
    }

    const service = getConnectorService(provider as ConnectorProvider);
    if (!service.handleOAuthCallback) {
      return res.redirect("/settings/email?connectorError=OAuth+not+supported");
    }

    const redirectUri = `${getBaseUrl(req)}/api/connectors/oauth/callback`;

    const result = await service.handleOAuthCallback(connector, code, redirectUri);

    if (!result.success) {
      return res.redirect(`/settings/email?connectorError=${encodeURIComponent(result.error || "Auth failed")}`);
    }

    const updateData: any = {
      status: "active",
      updatedAt: new Date(),
    };

    if (result.emailAddress) {
      updateData.emailAddress = result.emailAddress;
    }

    if (result.credentials) {
      updateData.credentialsEncrypted = encryptSecret(JSON.stringify(result.credentials));
    }

    const [updated] = await db.update(mailConnectors).set(updateData).where(connectorById(connectorId)).returning();

    await logEvent(connectorId, connector.orgId, "auth_success", `OAuth completed: ${result.emailAddress || "unknown"}`);

    if (updated.enabled && updated.provider !== "forwarding") {
      startPollerForConnector(updated);
    }

    return res.redirect("/settings/email?connectorSuccess=true");
  } catch (err: any) {
    console.error("[connectors] OAuth callback error:", err.message);
    return res.redirect(`/settings/email?connectorError=${encodeURIComponent("Auth processing failed")}`);
  }
});

router.get("/api/admin/connectors", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const allConnectors = await db.select().from(mailConnectors).orderBy(desc(mailConnectors.createdAt));
    const enriched = await Promise.all(
      allConnectors.map(async (c) => {
        const { storage: st } = await import("../storage");
        const org = await st.getOrg(c.orgId);
        const pollerStatus = getConnectorPollerStatusById(c.id);
        return {
          ...sanitizeConnector(c),
          orgName: org?.name || "Unknown",
          orgPlan: (org && "plan" in org ? (org as Record<string, unknown>).plan : "free") || "free",
          pollerRunning: pollerStatus?.running || false,
          pollerDisabled: pollerStatus?.disabled || false,
        };
      })
    );
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/connectors/pollers", requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    res.json(getConnectorPollerStatus());
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get("/api/admin/connectors/:id/events", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const connId = String(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const events = await db.select().from(connectorEvents)
      .where(sql`${connectorEvents.connectorId} = ${connId}`)
      .orderBy(desc(connectorEvents.createdAt))
      .limit(limit);
    res.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: safeError({ message }) });
  }
});

router.get("/api/admin/connectors/events", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const events = await db.select().from(connectorEvents)
      .orderBy(desc(connectorEvents.createdAt))
      .limit(limit);
    res.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: safeError({ message }) });
  }
});

router.post("/api/admin/connectors/:id/force-poll", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const connId = String(req.params.id);
    const result = await forcePollConnector(connId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/connectors/:id/disable", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const connId = String(req.params.id);
    stopPollerForConnector(connId);
    const [updated] = await db.update(mailConnectors).set({
      enabled: false,
      status: "disabled",
      lastError: "Disabled by super admin",
      updatedAt: new Date(),
    }).where(connectorById(connId)).returning();

    if (!updated) return res.status(404).json({ error: "Connector not found" });

    await logEvent(updated.id, updated.orgId, "disabled", "Disabled by super admin");
    res.json(sanitizeConnector(updated));
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post("/api/admin/connectors/:id/enable", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const connId = String(req.params.id);
    const [updated] = await db.update(mailConnectors).set({
      enabled: true,
      status: "active",
      consecutiveFailures: 0,
      lastError: null,
      updatedAt: new Date(),
    }).where(connectorById(connId)).returning();

    if (!updated) return res.status(404).json({ error: "Connector not found" });

    if (updated.provider !== "forwarding") {
      startPollerForConnector(updated);
    }

    await logEvent(updated.id, updated.orgId, "enabled", "Enabled by super admin");
    res.json(sanitizeConnector(updated));
  } catch (err: any) {
    res.status(500).json({ error: safeError(err) });
  }
});

async function logEvent(connectorId: string, orgId: string, eventType: ConnectorEventType, message: string, metadata?: Record<string, unknown> | null) {
  try {
    await db.insert(connectorEvents).values({
      connectorId,
      orgId,
      eventType,
      message,
      metadata: metadata || null,
    });
  } catch (err: unknown) {
    console.error("[connectors] Failed to log event:", err instanceof Error ? err.message : "Unknown error");
  }
}

export default router;
