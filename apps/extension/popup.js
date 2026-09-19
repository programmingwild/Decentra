/* Decentra Meet Capture — popup logic. Plain script (MV3-safe, no modules). */
"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = { apiUrl: "http://localhost:8000", webUrl: "http://localhost:3000" };

async function get(keys) {
  return chrome.storage.local.get(keys);
}
async function set(obj) {
  return chrome.storage.local.set(obj);
}
function apiBase(u) {
  return (u || DEFAULTS.apiUrl).replace(/\/$/, "");
}

function status(msg, cls = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = cls;
}

async function authedFetch(path, opts = {}) {
  const { apiUrl, access } = await get(["apiUrl", "access"]);
  const headers = { ...(opts.headers || {}) };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(apiBase(apiUrl) + path, { ...opts, headers });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function init() {
  const s = await get(["apiUrl", "webUrl", "email", "access", "orgId"]);
  $("apiUrl").value = s.apiUrl || DEFAULTS.apiUrl;
  $("webUrl").value = s.webUrl || DEFAULTS.webUrl;
  $("email").value = s.email || "demo@decentra.ai";
  if (s.access) {
    $("authBox").style.display = "none";
    $("mainBox").style.display = "block";
    await loadOrgs(s.orgId);
  }
  poll();
}

async function persistUrls() {
  // Changing the API origin needs host permission for fetch from the worker.
  const apiUrl = $("apiUrl").value.trim() || DEFAULTS.apiUrl;
  try {
    const origin = new URL(apiUrl).origin + "/*";
    const granted = await chrome.permissions.contains({ origins: [origin] });
    if (!granted) {
      const ok = await chrome.permissions.request({ origins: [origin] });
      if (!ok) throw new Error("Browser blocked API access — allow the host permission");
    }
  } catch (e) {
    if (String(e.message || "").startsWith("Browser blocked")) throw e;
    throw new Error("Bad API URL");
  }
  await set({ apiUrl, webUrl: $("webUrl").value.trim() || DEFAULTS.webUrl });
}

$("loginBtn").addEventListener("click", async () => {
  status("Signing in…");
  try {
    await persistUrls();
    const email = $("email").value.trim();
    const password = $("password").value;
    const { apiUrl } = await get(["apiUrl"]);
    const res = await fetch(apiBase(apiUrl) + "/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid email or password");
    const data = await res.json();
    await set({ access: data.access_token, refresh: data.refresh_token, email });
    $("authBox").style.display = "none";
    $("mainBox").style.display = "block";
    await loadOrgs();
    status("Signed in ✓");
  } catch (e) {
    status(String(e.message || e), "error");
  }
});

async function loadOrgs(selected) {
  try {
    const orgs = await authedFetch("/api/v1/organizations");
    const sel = $("org");
    sel.innerHTML = "";
    for (const o of orgs) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.name;
      sel.appendChild(opt);
    }
    const { orgId } = await get(["orgId"]);
    sel.value = selected || orgId || (orgs[0] && orgs[0].id) || "";
    if (!orgs.length) status("No organizations — create one in Decentra first", "error");
  } catch (e) {
    status("Session expired — sign in again", "error");
    $("authBox").style.display = "block";
    $("mainBox").style.display = "none";
  }
}

$("org").addEventListener("change", (e) => set({ orgId: e.target.value }));

$("startBtn").addEventListener("click", async () => {
  status("Starting…");
  $("link").style.display = "none";
  try {
    await persistUrls();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith("https://meet.google.com/")) {
      throw new Error("Open a Google Meet tab first, then Start");
    }
    await set({ orgId: $("org").value });
    const res = await chrome.runtime.sendMessage({
      type: "POP_START",
      orgId: $("org").value,
      tabId: tab.id,
      title: tab.title || "Captured meeting",
    });
    if (!res || !res.ok) throw new Error((res && res.error) || "Start failed");
    $("startBtn").disabled = true;
    $("stopBtn").disabled = false;
    status("Capturing… speak and watch the counter", "live");
  } catch (e) {
    status(String(e.message || e), "error");
  }
});

$("stopBtn").addEventListener("click", async () => {
  status("Uploading transcript & processing…", "live");
  try {
    const res = await chrome.runtime.sendMessage({ type: "POP_STOP" });
    if (!res || !res.ok) throw new Error((res && res.error) || "Stop failed");
    $("startBtn").disabled = false;
    $("stopBtn").disabled = true;
    status(`Done — ${res.count} segments sent for processing`, "live");
    if (res.url) {
      $("openLink").href = res.url;
      $("link").style.display = "block";
    }
  } catch (e) {
    status(String(e.message || e), "error");
  }
});

function fmtElapsed(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

async function poll() {
  try {
    const st = await chrome.runtime.sendMessage({ type: "POP_STATE" });
    if (st && st.capturing) {
      $("startBtn").disabled = true;
      $("stopBtn").disabled = false;
      const hint = st.lines === 0 ? " — turn on CC in Meet if this stays 0" : "";
      status(`Capturing ${fmtElapsed(st.elapsed)} · ${st.lines} lines · ${st.words} words${hint}`, "live");
    } else if (!$("stopBtn").disabled) {
      $("startBtn").disabled = false;
      $("stopBtn").disabled = true;
    }
  } catch (_) {
    /* worker asleep — next poll wakes it */
  }
  setTimeout(poll, 1000);
}

init();
