"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "./api";

type User = { id: string; email: string; full_name?: string };
type Ctx = { user: User | null; login: (e: string, p: string) => Promise<void>; logout: () => void; register: (e: string, p: string, n?: string) => Promise<void>; orgs: any[]; refreshOrgs: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as any);

// Shared in-flight burst: GET /me + GET /organizations — resolved once and
// shared between the AuthProvider mount and the overview page's loadAll.
let _inflight: Promise<[User, any[]]> | null = null;
let _inflightAt = 0;

export function getMeAndOrgs(): Promise<[User, any[]]> {
  const now = Date.now();
  if (_inflight && now - _inflightAt < 2000) return _inflight;
  _inflight = Promise.all([api("/api/v1/auth/me"), api("/api/v1/organizations")] as [Promise<any>, Promise<any[]>])
    .then(([me, orgs]) => { _inflight = null; _inflightAt = 0; return [me, orgs] as [User, any[]]; })
    .catch((e: any) => { _inflight = null; _inflightAt = 0; throw e; }) as unknown as Promise<[User, any[]]>;
  _inflightAt = now;
  return _inflight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);

  async function fetchMeLocal() {
    try { const [me, orgs] = await getMeAndOrgs(); setUser(me); setOrgs(orgs); } catch { setUser(null); }
  }
  useEffect(() => { fetchMeLocal(); }, []);

  async function login(email: string, password: string) {
    const r = await api("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (r?.access_token) setAccessToken(r.access_token);
    // Shared burst — overview mount will grab it in parallel.
    fetchMeLocal();
  }
  async function register(email: string, password: string, full_name?: string) {
    const r = await api("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name }) });
    if (r?.access_token) setAccessToken(r.access_token);
    await fetchMeLocal();
  }
  function logout() {
    api("/api/v1/auth/logout", { method: "POST", retry: false }).catch(() => {});
    setAccessToken(null);
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  }

  return <AuthCtx.Provider value={{ user, login, logout, register, orgs, refreshOrgs: fetchMeLocal }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);