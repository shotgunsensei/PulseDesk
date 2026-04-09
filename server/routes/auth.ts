import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireOrg } from "../middleware";
import { hashPassword, verifyPassword } from "../middleware";

const router = Router();

router.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    const existing = await storage.getUserByUsername(username.trim());
    if (existing) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const user = await storage.createUser({
      username: username.trim(),
      password: await hashPassword(password),
      fullName: fullName?.trim() || username.trim(),
      phone: "",
      email: "",
    });

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      res.json({ user: { ...user, password: undefined } });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (/^[0-9a-f]{64}$/.test(user.password)) {
      const newHash = await hashPassword(password);
      await storage.updateUser(user.id, { password: newHash });
    }

    req.session.userId = user.id;

    const userOrgs = await storage.getUserOrgs(user.id);
    if (userOrgs.length > 0) {
      req.session.orgId = userOrgs[0].id;
    }

    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      res.json({ user: { ...user, password: undefined } });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.delete("/api/auth/delete-account", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    await storage.deleteUser(userId);
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete account" });
  }
});

router.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "User not found" });

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

    let orgCounts = null;
    if (org) {
      orgCounts = await storage.getOrgCounts(org.id);
    }

    res.json({
      user: { ...user, password: undefined },
      org,
      membership,
      orgs: userOrgs,
      orgCounts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/auth/switch-org", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.body;
    const membership = await storage.getMembership(orgId, req.session.userId!);
    if (!membership) return res.status(403).json({ error: "Not a member of this organization" });
    req.session.orgId = orgId;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fullName, phone, email } = req.body;
    if (!fullName?.trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }
    const user = await storage.updateUser(req.session.userId!, {
      fullName: fullName.trim(),
      phone: phone?.trim() || "",
      email: email?.trim() || "",
    });
    res.json({ ...user, password: undefined });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    const newHash = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: newHash });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/members", requireAuth, requireOrg, async (req: Request, res: Response) => {
  try {
    const mems = await storage.getOrgMemberships(req.session.orgId!);
    const result = [];
    for (const m of mems) {
      const u = await storage.getUser(m.userId);
      if (u) {
        result.push({
          ...m,
          fullName: u.fullName,
          username: u.username,
          email: u.email,
        });
      }
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
