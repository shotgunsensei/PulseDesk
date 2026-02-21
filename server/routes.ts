import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { pool } from "./db";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
    orgId?: string;
  }
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function requireOrg(req: Request, res: Response, next: NextFunction) {
  if (!req.session.orgId) {
    return res.status(400).send("No organization selected");
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgSession({
        pool: pool as any,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "tradeflow-dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, fullName } = req.body;
      if (!username || !password) {
        return res.status(400).send("Username and password required");
      }
      if (password.length < 6) {
        return res.status(400).send("Password must be at least 6 characters");
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).send("Username already taken");
      }

      const user = await storage.createUser({
        username,
        password: hashPassword(password),
        fullName: fullName || username,
        phone: "",
        email: "",
      });

      req.session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).send("Invalid credentials");
      }

      req.session.userId = user.id;

      const userOrgs = await storage.getUserOrgs(user.id);
      if (userOrgs.length > 0) {
        req.session.orgId = userOrgs[0].id;
      }

      res.json({ user: { ...user, password: undefined } });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).send("User not found");

      const userOrgs = await storage.getUserOrgs(user.id);

      let org = null;
      let membership = null;

      if (req.session.orgId) {
        org = await storage.getOrg(req.session.orgId);
        membership = await storage.getMembership(req.session.orgId, user.id);
      }

      if (!org && userOrgs.length > 0) {
        org = userOrgs[0];
        req.session.orgId = org.id;
        membership = await storage.getMembership(org.id, user.id);
      }

      res.json({
        user: { ...user, password: undefined },
        org,
        membership,
        orgs: userOrgs,
      });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/auth/switch-org", requireAuth, async (req: Request, res: Response) => {
    try {
      const { orgId } = req.body;
      const membership = await storage.getMembership(orgId, req.session.userId!);
      if (!membership) return res.status(403).send("Not a member of this organization");
      req.session.orgId = orgId;
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fullName, phone, email } = req.body;
      const user = await storage.updateUser(req.session.userId!, { fullName, phone, email });
      res.json({ ...user, password: undefined });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/orgs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, slug, phone, email, address } = req.body;
      if (!name) return res.status(400).send("Organization name required");

      const org = await storage.createOrg({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        phone: phone || "",
        email: email || "",
        address: address || "",
      });

      await storage.createMembership(org.id, req.session.userId!, "owner");
      req.session.orgId = org.id;
      res.json(org);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/orgs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      if (req.params.id !== req.session.orgId) {
        return res.status(403).send("Cannot edit another organization");
      }
      const org = await storage.updateOrg(req.params.id, req.body);
      res.json(org);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/orgs/join", requireAuth, async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      const invite = await storage.getInviteCodeByCode(code);
      if (!invite) return res.status(400).send("Invalid invite code");

      const existing = await storage.getMembership(invite.orgId, req.session.userId!);
      if (existing) return res.status(400).send("Already a member");

      await storage.createMembership(invite.orgId, req.session.userId!, invite.role);
      req.session.orgId = invite.orgId;
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/invite-codes", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const codes = await storage.getOrgInviteCodes(req.session.orgId!);
      res.json(codes);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/invite-codes", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const code = await storage.createInviteCode(
        req.session.orgId!,
        role || "tech",
        req.session.userId!
      );
      res.json(code);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/customers", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getCustomers(req.session.orgId!);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const c = await storage.getCustomer(req.session.orgId!, req.params.id);
      if (!c) return res.status(404).send("Customer not found");
      res.json(c);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/customers/:id/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getCustomerJobs(req.session.orgId!, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/customers/:id/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getCustomerInvoices(req.session.orgId!, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/customers", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const c = await storage.createCustomer(req.session.orgId!, req.body);
      res.json(c);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const c = await storage.updateCustomer(req.session.orgId!, req.params.id, req.body);
      if (!c) return res.status(404).send("Customer not found");
      res.json(c);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.delete("/api/customers/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      await storage.deleteCustomer(req.session.orgId!, req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getJobs(req.session.orgId!);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const j = await storage.getJob(req.session.orgId!, req.params.id);
      if (!j) return res.status(404).send("Job not found");
      res.json(j);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/jobs/:id/events", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const events = await storage.getJobEvents(req.session.orgId!, req.params.id);
      res.json(events);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/jobs", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const j = await storage.createJob(req.session.orgId!, req.body, req.session.userId!);
      res.json(j);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const j = await storage.updateJob(req.session.orgId!, req.params.id, req.body);
      if (!j) return res.status(404).send("Job not found");
      res.json(j);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.delete("/api/jobs/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      await storage.deleteJob(req.session.orgId!, req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getQuotes(req.session.orgId!);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const q = await storage.getQuote(req.session.orgId!, req.params.id);
      if (!q) return res.status(404).send("Quote not found");
      res.json(q);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/quotes", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const q = await storage.createQuote(req.session.orgId!, req.body, req.session.userId!);
      res.json(q);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const q = await storage.updateQuote(req.session.orgId!, req.params.id, req.body);
      if (!q) return res.status(404).send("Quote not found");
      res.json(q);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.delete("/api/quotes/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      await storage.deleteQuote(req.session.orgId!, req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/quotes/:id/convert-to-job", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const quote = await storage.getQuote(req.session.orgId!, req.params.id);
      if (!quote) return res.status(404).send("Quote not found");

      const job = await storage.createJob(
        req.session.orgId!,
        {
          title: `Job from Quote #${quote.id.slice(0, 8)}`,
          description: quote.notes || "",
          customerId: quote.customerId || null,
          status: "scheduled",
        },
        req.session.userId!
      );

      await storage.updateQuote(req.session.orgId!, req.params.id, {
        status: "accepted",
        jobId: job.id,
      });

      res.json(job);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const result = await storage.getInvoices(req.session.orgId!);
      res.json(result);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const inv = await storage.getInvoice(req.session.orgId!, req.params.id);
      if (!inv) return res.status(404).send("Invoice not found");
      res.json(inv);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.post("/api/invoices", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const inv = await storage.createInvoice(req.session.orgId!, req.body, req.session.userId!);
      res.json(inv);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.patch("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const inv = await storage.updateInvoice(req.session.orgId!, req.params.id, req.body);
      if (!inv) return res.status(404).send("Invoice not found");
      res.json(inv);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.delete("/api/invoices/:id", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      await storage.deleteInvoice(req.session.orgId!, req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/dashboard", requireAuth, requireOrg, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats(req.session.orgId!);
      res.json(stats);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  return httpServer;
}
