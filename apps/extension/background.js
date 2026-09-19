/* Decentra Meet Capture — background service worker.
 *
 * Owns the capture session: opens a Decentra meeting, accumulates caption
 * deltas into timestamped segments, and on stop uploads a transcript JSON
 * through the exact same pipeline as a manual upload
 * (recording -> transcript -> intelligence -> decisions/actions).
 */
"use strict";

const FLUSH_ALARM = "decentra-flush";
const IDLE_CLOSE_SECS = 4;

let session = null; // {tabId, meetingId, orgId, title, t0, segments[], open, lines, words}

const store = {
  async get(keys) {
    return chrome.storage.local.get(keys);
  },
  async set(obj) {
    return chrome.storage.local.set(obj);
  },
};

function nowSecs() {
  return Date.now() / 1000;
}

async function api(path, { method = "GET", body = null, form = null, retryAuth = true } = {}) {
  const { apiUrl, access } = await store.get(["apiUrl", "access"]);
  if (!apiUrl) throw new Error("Set the API URL in the popup first");
  const headers = {};
  if (access) headers.Authorization = `Bearer ${access}`;
  const init = { method, headers };
  if (form) init.body = form;
  else if (body !== null) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res = await fetch(apiUrl.replace(/\/$/, "") + path, init);
  if (res.status === 401 && retryAuth) {
    if (await tryRefresh()) return api(path, { method, body, form, retryAuth: false });
    throw new Error("Session expired — sign in again in the popup");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function tryRefresh() {
  const { apiUrl, refresh } = await store.get(["apiUrl", "refresh"]);
  if (!apiUrl || !refresh) return false;
  try {
    const res = await fetch(apiUrl.replace(/\/$/, "") + "/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.access_token) {
      await store.set({ access: data.access_token });
      if (data?.refresh_token) await store.set({ refresh: data.refresh_token });
      return true;
    }
  } catch (_) {
    /* offline */
  }
  return false;
}

/* ── segment accumulation ────────────────────────────────
 * One open segment per speaker. Suffix growth extends it; anything else
 * closes it and opens a fresh one. Stale segments are sealed by the alarm.
 */
function ingestText(speaker, text, reset) {
  if (!session) return;
  const t = Math.floor(nowSecs() - session.t0);
  const cur = session.open[speaker];
  if (reset || !cur) {
    if (cur && cur.text.trim()) closeSegment(speaker);
    session.open[speaker] = { speaker, text, start: t, end: t };
  } else {
    cur.text = text;
    cur.end = t;
  }
  session.lines += 1;
  session.words += text.split(/\s+/).filter(Boolean).length;
}

function closeSegment(speaker) {
  const cur = session.open[speaker];
  if (!cur) return;
  // end = last words heard, not seal time — evidence stays honest.
  const end = Math.max(cur.end, cur.start + 1);
  session.segments.push({ speaker: cur.speaker, text: cur.text.trim(), start: cur.start, end });
  delete session.open[speaker];
}

function closeAll() {
  if (!session) return;
  for (const speaker of Object.keys(session.open)) closeSegment(speaker);
}

async function flushIdle() {
  if (!session) return;
  const t = Math.floor(nowSecs() - session.t0);
  // Seal a segment only when its speaker went quiet; active speech keeps
  // extending it on the next delta. (end marks last words, not seal time.)
  for (const [speaker, cur] of Object.entries(session.open)) {
    if (t - cur.end >= IDLE_CLOSE_SECS && cur.text.trim()) closeSegment(speaker);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) flushIdle();
});

/* ── message protocol ──────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "CAP_TEXT": {
        if (session && sender.tab && sender.tab.id === session.tabId) {
          ingestText(msg.speaker || "Speaker", msg.text || "", !!msg.reset);
        }
        sendResponse({ ok: true });
        break;
      }
      case "POP_STATE": {
        sendResponse({
          capturing: !!session,
          lines: session?.lines || 0,
          words: session?.words || 0,
          meetingId: session?.meetingId || null,
          elapsed: session ? Math.floor(nowSecs() - session.t0) : 0,
        });
        break;
      }
      case "POP_START": {
        const { orgId, tabId, title } = msg;
        if (!orgId) throw new Error("Pick an organization first");
        const meeting = await api(`/api/v1/meetings?org_id=${encodeURIComponent(orgId)}`, {
          method: "POST",
          body: { title: title || `Captured meeting ${new Date().toLocaleString()}` },
        });
        session = {
          tabId, orgId, meetingId: meeting.id, title: meeting.title,
          t0: nowSecs(), segments: [], open: {}, lines: 0, words: 0,
        };
        await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 / 12 });
        sendResponse({ ok: true, meetingId: meeting.id });
        break;
      }
      case "POP_STOP": {
        if (!session) {
          sendResponse({ ok: false, error: "Nothing capturing" });
          break;
        }
        closeAll();
        const { meetingId, segments } = session;
        const { webUrl } = await store.get(["webUrl"]);
        if (!segments.length) {
          session = null;
          await chrome.alarms.clear(FLUSH_ALARM);
          throw new Error("No captions captured — turn on CC in Meet and retry");
        }
        const payload = JSON.stringify({
          source: "decentra-extension",
          segments: segments.map((s) => ({
            speaker: s.speaker, start: s.start, end: s.end, text: s.text,
          })),
        });
        const form = new FormData();
        form.append(
          "file",
          new File([payload], "transcript.json", { type: "application/json" })
        );
        await api(`/api/v1/meetings/${meetingId}/recording`, { method: "POST", form });
        await api(`/api/v1/meetings/${meetingId}/process`, { method: "POST", body: {} });
        const done = { meetingId, count: segments.length };
        session = null;
        await chrome.alarms.clear(FLUSH_ALARM);
        sendResponse({
          ok: true, ...done,
          url: `${(webUrl || "http://localhost:3000").replace(/\/$/, "")}/meetings/${meetingId}`,
        });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown message" });
    }
  })().catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true; // async sendResponse
});
