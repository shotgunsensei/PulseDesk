import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User, Org, Membership } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  org: Org | null;
  membership: Membership | null;
  orgs: Org[];
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setOrg(data.org);
        setMembership(data.membership);
        setOrgs(data.orgs || []);
      } else {
        setUser(null);
        setOrg(null);
        setMembership(null);
        setOrgs([]);
      }
    } catch {
      setUser(null);
      setOrg(null);
      setMembership(null);
      setOrgs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Login failed");
    }
    await refreshAuth();
  };

  const register = async (username: string, password: string, fullName: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, fullName }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Registration failed");
    }
    await refreshAuth();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setOrg(null);
    setMembership(null);
    setOrgs([]);
  };

  const switchOrg = async (orgId: string) => {
    const res = await fetch("/api/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
      credentials: "include",
    });
    if (res.ok) {
      await refreshAuth();
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, org, membership, orgs, isLoading, login, register, logout, switchOrg, refreshAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
