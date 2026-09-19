"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "./api";

type User = { id: string; email: string; full_name?: string };
type Ctx = { user: User | null; login: (e: string, p: string) => Promise<void>; logout: () => void; register: (e: string, p: string, n?: string) => Promise<void>; orgs: any[]; refreshOrgs: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);

  async function refreshOrgs() {
    try { const o = await api("/api/v1/organizations"); setOrgs(o); } catch { /* orgs stay as-is; surfaced where used */ }
  }
  async function fetchMe() {
    try { const me = await api("/api/v1/auth/me"); setUser(me); await refreshOrgs(); } catch { setUser(null); }
  }
  useEffect(() => { fetchMe(); }, []);

  async function login(email: string, password: string) {
    const r = await api("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    // Access token: short-lived (30m), memory-only (see lib/api).
    // Refresh token: httpOnly cookie set by the API — never touches JS.
    if (r?.access_token) setAccessToken(r.access_token);
    await fetchMe();
  }
  async function register(email: string, password: string, full_name?: string) {
    const r = await api("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name }) });
    if (r?.access_token) setAccessToken(r.access_token);
    await fetchMe();
  }
  function logout() {
    // Tell the API to revoke the refresh family (best-effort),
    // then drop the access token and leave.
    api("/api/v1/auth/logout", { method: "POST", retry: false }).catch(() => {});
    setAccessToken(null);
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  }

  return <AuthCtx.Provider value={{ user, login, logout, register, orgs, refreshOrgs }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
