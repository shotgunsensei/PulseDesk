import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes/index";
import { serveStatic } from "./static";
import { createServer } from "http";
import { isAppError } from "./errors";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
  skip: () => process.env.NODE_ENV !== "production",
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      const { WebhookHandlers } = await import('./webhookHandlers');
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      const isSignatureError =
        err?.type === 'StripeSignatureVerificationError' ||
        err?.message?.includes('No signatures found') ||
        err?.message?.includes('STRIPE WEBHOOK ERROR');
      if (isSignatureError) {
        console.error('[stripe webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }
      console.error('[stripe webhook] Processing error (returning 200 to prevent retries):', err.message);
      res.status(200).json({ received: true, warning: 'Processing error logged' });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 200)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  log("Connecting to database...", "startup");
  try {
    const { pool: dbPool } = await import("./db");
    const testResult = await dbPool.query("SELECT current_database(), current_user");
    log(`Database connected: db=${testResult.rows[0].current_database}, user=${testResult.rows[0].current_user}`, "startup");
  } catch (dbErr: any) {
    log(`DATABASE CONNECTION FAILED: ${dbErr.message}`, "startup");
    process.exit(1);
  }

  log("Running schema migrations...", "startup");
  const { ensureSchema } = await import("./migrate");
  await ensureSchema();
  log("Schema migrations complete", "startup");

  const { seedDatabase, ensureSuperAdmin, ensureDemoAccount, ensureReviewerAccount } = await import("./seed");
  await seedDatabase();
  await ensureSuperAdmin();
  await ensureDemoAccount();
  await ensureReviewerAccount();

  try {
    const { pool: dbPool } = await import("./db");
    const sessionCheck = await dbPool.query(`SELECT COUNT(*) as cnt FROM "session"`);
    log(`Session table verified: ${sessionCheck.rows[0].cnt} existing sessions`, "startup");
  } catch (sessErr: any) {
    log(`SESSION TABLE CHECK FAILED: ${sessErr.message}`, "startup");
  }

  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      await runMigrations({ databaseUrl });
      const { getStripeSync } = await import('./stripeClient');
      const stripeSync = await getStripeSync();
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
      await stripeSync.syncBackfill();
      log("Stripe sync initialized");
    }
  } catch (err: any) {
    log(`Stripe init skipped: ${err.message}`, "stripe");
  }

  log("Registering routes and session middleware...", "startup");
  await registerRoutes(httpServer, app);
  log("Routes registered, accepting traffic", "startup");

  try {
    const { startImapPolling, setMigratedOrgFilter } = await import("./services/imapPoller");
    try {
      const { pool: dbPool } = await import("./db");
      const migrated = await dbPool.query(
        `SELECT DISTINCT org_id FROM email_settings WHERE imap_migrated_to_connector = true`
      );
      const migratedOrgIds = new Set(migrated.rows.map((r: any) => r.org_id));
      if (migratedOrgIds.size > 0) {
        setMigratedOrgFilter(migratedOrgIds);
        log(`Legacy IMAP poller will skip ${migratedOrgIds.size} migrated org(s)`, "startup");
      }
    } catch {}
    await startImapPolling();
    log("IMAP polling service started", "startup");
  } catch (err: any) {
    log(`IMAP polling init skipped: ${err.message}`, "startup");
  }

  try {
    const { initConnectorServices } = await import("./services/connectors/index");
    initConnectorServices();
    const { startConnectorPolling } = await import("./services/connectorPoller");
    await startConnectorPolling();
    log("Connector polling service started", "startup");
  } catch (err: any) {
    log(`Connector polling init skipped: ${err.message}`, "startup");
  }

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const isProduction = process.env.NODE_ENV === "production";

    if (isAppError(err)) {
      return res.status(err.statusCode).json({
        message: err.message,
      });
    }

    const status = (err as { status?: number; statusCode?: number })?.status
      ?? (err as { status?: number; statusCode?: number })?.statusCode
      ?? 500;

    const message = isProduction
      ? "An unexpected error occurred"
      : (err instanceof Error ? err.message : "Internal Server Error");

    console.error("[unhandled error]", err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
