// Same-origin by default: requests go to the web origin and Next's
// rewrite proxy forwards /api/v1/* to the API server-side. This keeps auth
// cookies first-party on any cloud host with zero domain setup. Set
// NEXT_PUBLIC_API_URL only to call the API directly (bypasses the proxy).
const API = process.env.NEXT_PUBLIC_API_URL || "";

// DEMO BUILD: authentication is intentionally bypassed. Every request carries
// a trusted demo header; the API resolves demo@decentra.ai from it. No login
// POST, no token check, no 401 refresh/redirect — the login screen is visual
// only. Remove DEMO (and the API-side header check) for a real deployment.
const DEMO = true;
const DEMO_HEADERS = { "X-Decentra-Demo": "1" };

/** Status-preserving error so callers can branch on 401/404/429/5xx. */
export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(body || `Request failed ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Strict posture: the access token lives in memory so XSS cannot scrape
// it from storage. localStorage is a read-only legacy fallback for sessions
// created before this change (migrates them without forcing re-login).
let memoryToken: string | null = null;

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryToken) return memoryToken;
  return localStorage.getItem("access_token");
}

/** Persist a fresh access token: memory-first, never long-term storage. */
export function setAccessToken(token: string | null) {
  memoryToken = token;
  if (typeof window === "undefined") return;
  if (token) localStorage.removeItem("access_token");
}

function authHeader() {
  const t = getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function clearSession() {
  if (typeof window === "undefined") return;
  setAccessToken(null);
  localStorage.removeItem("access_token"); // legacy leftovers
  // NOTE: the refresh token lives in an httpOnly cookie (set by the API on
  // login) — JS cannot clear it, so best-effort tell the API to clear it.
  fetch(`${API}/api/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path === "/") return; // already public
  window.location.href = `/login?next=${encodeURIComponent(path)}`;
}

// Single-flight refresh: N concurrent 401s trigger exactly one refresh call.
let refreshPromise: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Sends the httpOnly refresh cookie; empty body = cookie flow.
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.access_token) {
          setAccessToken(data.access_token);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ApiOpts = RequestInit & {
  /** ms before aborting. Default 60s — Render free tier wakes sleeping
   *  services on the first request after ~5 min idle, which can exceed 30s. */
  timeoutMs?: number;
  /** GET-only retries on 429/502/503/504 with backoff. Default true. */
  retry?: boolean;
};

export async function api(path: string, opts: ApiOpts = {}): Promise<any> {
  const { timeoutMs = 60000, retry = true, ...init } = opts;
  const method = (init.method || "GET").toUpperCase();
  const headers: any = { ...DEMO_HEADERS, ...(init.headers || {}), ...authHeader() };
  if (!(init.body instanceof FormData)) headers["Content-Type"] = headers["Content-Type"] || "application/json";
  if (init.body instanceof FormData) delete headers["Content-Type"];

  const doFetch = async (attempt: number): Promise<any> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, { ...init, headers, signal: ctrl.signal, credentials: "include" });
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        const timeoutErr = new ApiError(408, `Request timed out after ${timeoutMs}ms`);
        // Timeouts are transient, not credential problems: retry once even on
        // auth endpoints — a timed-out login means the request just didn't
        // finish in the budget (e.g. Render waking a sleeping service).
        if (retry && attempt < 2) {
          await sleep(400 + Math.random() * 400);
          return doFetch(attempt + 1);
        }
        throw timeoutErr;
      }
      throw new ApiError(0, "Network unreachable — check your connection");
    }
    clearTimeout(timer);

    // Retry on transient failures (408 timeout + 429/5xx) — all methods; Render
    // cold starts make the first request after ~5 min idle exceed the timeout
    // budget, and the API's free-tier queueing returns 429/503s. Skip auth
    // endpoints for status retries so bad credentials surface once instead of
    // looping — timeouts still retry above, since they're not auth failures.
    // Backoff + jitter so we play nice with Render and the API rate limits.
    const isAuthEndpoint =
      path.includes("/auth/login") ||
      path.includes("/auth/register") ||
      path.includes("/auth/refresh") ||
      path.includes("/auth/logout");
    if (
      retry &&
      attempt < 2 &&
      (res.status === 408 || (!isAuthEndpoint && [429, 502, 503, 504].includes(res.status)))
    ) {
      const base = 400 * (attempt + 1);
      await sleep(base + Math.random() * base);
      return doFetch(attempt + 1);
    }
    if (res.status === 401 && !isAuthEndpoint && !DEMO) {
      // Access token expired? One silent refresh, then replay the request once.
      if (await tryRefresh()) return api(path, { ...opts, retry: false });
      clearSession();
      redirectToLogin();
      throw new ApiError(401, "Session expired — please sign in again");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Friendly messages for common cases; raw body preserved on .body.
      const friendly =
        res.status === 413 ? "File too large — compress it or pick a smaller file"
        : res.status === 429 ? "Too many requests — retrying with backoff"
        : res.status >= 500 ? "Server hiccup — retrying with backoff"
        : text;
      throw new ApiError(res.status, friendly || `Request failed ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  };

  return doFetch(0);
}

export const API_URL = API;

export type StreamEvents = {
  onEvidence?: (data: any) => void;
  onToken?: (delta: string) => void;
  onDone?: (data: any) => void;
  /** AbortSignal to cancel mid-stream (unmount, new question). */
  signal?: AbortSignal;
  /** Overall budget; default 120s (LLM + retrieval). */
  timeoutMs?: number;
};

/**
 * Consume a text/event-stream endpoint (assistant query/stream).
 * Same auth contract as api(): silent refresh once on 401, ApiError
 * otherwise. Resolves with the `done` payload. Evidence arrives first,
 * so callers can render citations while tokens flow.
 */
export async function apiStream(path: string, body: any, ev: StreamEvents = {}): Promise<any> {
  const headers: any = { "Content-Type": "application/json", ...DEMO_HEADERS, ...authHeader() };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ev.timeoutMs ?? 120000);
  const linked = ev.signal;
  if (linked) {
    if (linked.aborted) ctrl.abort();
    else linked.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
      credentials: "include",
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new ApiError(408, "Answer took too long — try a narrower question");
    throw new ApiError(0, "Network unreachable — check your connection");
  }
  if (res.status === 401 && !DEMO) {
    clearTimeout(timer);
    if (await tryRefresh()) return apiStream(path, body, { ...ev, signal: undefined });
    clearSession();
    redirectToLogin();
    throw new ApiError(401, "Session expired — please sign in again");
  }
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `Request failed ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done: any = null;
  try {
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() || "";
      for (const fr of frames) {
        let name = "", data = "";
        for (const ln of fr.split("\n")) {
          if (ln.startsWith("event:")) name = ln.slice(6).trim();
          else if (ln.startsWith("data:")) data += ln.slice(5).trim();
        }
        if (!name) continue;
        let payload: any = {};
        try {
          payload = data ? JSON.parse(data) : {};
        } catch {
          continue;
        }
        if (name === "evidence") ev.onEvidence?.(payload);
        else if (name === "token" && typeof payload.delta === "string") ev.onToken?.(payload.delta);
        else if (name === "done") done = payload;
        else if (name === "error") throw new ApiError(500, payload.message || "Generation failed");
      }
    }
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === "AbortError") throw new ApiError(408, "Answer took too long — try a narrower question");
    throw e;
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {}
  }
  if (!done) throw new ApiError(500, "Stream ended without an answer — retry");
  return done;
}
