import { Router } from "express";

const router = Router();

function safeAbsoluteUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return null;
    return url;
  } catch {
    return null;
  }
}

export function getOperatorOsNavigation() {
  const configuredBase = safeAbsoluteUrl(process.env.OPERATOROS_BASE_URL);
  const base = configuredBase ?? new URL("https://operatoros.net");
  const myApps = safeAbsoluteUrl(process.env.OPERATOROS_MY_APPS_URL) ?? new URL("/app", base);
  const logout = safeAbsoluteUrl(process.env.OPERATOROS_LOGOUT_URL) ?? new URL("/logout", base);
  return { myAppsUrl: myApps.toString(), logoutUrl: logout.toString() };
}

router.get("/api/public/operatoros-navigation", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ ...getOperatorOsNavigation(), localAuthEnabled: process.env.PULSEDESK_LOCAL_AUTH_ENABLED === "true" && process.env.NODE_ENV !== "production" });
});

router.get("/operatoros/return", (_req, res) => {
  res.redirect(302, getOperatorOsNavigation().myAppsUrl);
});

router.get("/logout", (req, res) => {
  const destination = req.session.authSource === "operatoros"
    ? getOperatorOsNavigation().logoutUrl
    : "/login";
  req.session.destroy(() => res.redirect(303, destination));
});

export default router;
