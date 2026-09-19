/* Decentra Meet Capture — content script.
 *
 * Reads Google Meet's live-caption DOM and streams finalized text deltas to
 * the background worker. Meet re-renders interim captions in place, so we
 * diff per speaker and only forward NEW words (suffix growth). Anything else
 * (speaker switch, rewrite) starts a fresh segment downstream.
 *
 * If Meet changes its DOM, update SELECTORS below — that is the ONLY place
 * coupled to Meet's markup. The popup shows a live line counter so a broken
 * selector is visible in seconds, not after a meeting.
 */
"use strict";

const SELECTORS = {
  // Caption overlay candidates, first match wins.
  containers: ['[jsname="dsyhDe"]', 'div[aria-label="Captions"]', ".a4cQT"],
  // One row per speaker turn inside the container.
  rows: [".iOzk7", ".nMcdL"],
  // Speaker name inside a row.
  speakers: [".NWpY1d", ".AT7nec", ".zs7s8e"],
  // Spoken text inside a row.
  texts: [".a4cQT", ".ygicle", ".VbkSUb"],
};

const lastSent = new Map(); // speaker -> last full text already forwarded
let container = null;
let observer = null;

function pick(root, list) {
  for (const sel of list) {
    try {
      const el = root.querySelector(sel);
      if (el) return sel;
    } catch (_) {
      /* invalid selector — try next */
    }
  }
  return null;
}

function findContainer() {
  for (const sel of SELECTORS.containers) {
    try {
      const el = document.querySelector(sel);
      if (el) return el.closest("div")?.parentElement || el;
    } catch (_) {
      /* next */
    }
  }
  return null;
}

function extractRows(scope) {
  const rowSel = pick(scope, SELECTORS.rows);
  const textSel = pick(scope, SELECTORS.texts);
  const out = [];
  if (rowSel && textSel) {
    const spkSel = pick(scope, SELECTORS.speakers);
    for (const row of scope.querySelectorAll(rowSel)) {
      const textEl = row.querySelector(textSel);
      if (!textEl) continue;
      const text = (textEl.innerText || "").trim();
      if (!text) continue;
      const spkEl = spkSel ? row.querySelector(spkSel) : null;
      out.push({ speaker: ((spkEl && spkEl.innerText) || "Speaker").trim(), text });
    }
    return out;
  }
  // Fallback: bare text nodes (no row structure matched).
  if (textSel) {
    for (const el of scope.querySelectorAll(textSel)) {
      const text = (el.innerText || "").trim();
      if (text) out.push({ speaker: "Speaker", text });
    }
  }
  return out;
}

function forward(rows) {
  for (const { speaker, text } of rows) {
    const prev = lastSent.get(speaker) || "";
    if (text === prev || text.length < prev.length) {
      // Unchanged, or a rewrite/correction — background treats shrinkage
      // as a fresh segment; resync the baseline.
      if (text !== prev) {
        lastSent.set(speaker, text);
        chrome.runtime.sendMessage({ type: "CAP_TEXT", speaker, text, reset: true });
      }
      continue;
    }
    if (text.startsWith(prev)) {
      lastSent.set(speaker, text);
      const delta = text.slice(prev.length).trim();
      if (delta) chrome.runtime.sendMessage({ type: "CAP_TEXT", speaker, text, delta });
    } else {
      lastSent.set(speaker, text);
      chrome.runtime.sendMessage({ type: "CAP_TEXT", speaker, text, reset: true });
    }
  }
}

function scan() {
  const scope = container || document;
  try {
    forward(extractRows(scope));
  } catch (_) {
    /* DOM mid-mutation — next tick picks it up */
  }
}

function attach() {
  container = findContainer();
  const target = container || document.body;
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => scan());
  observer.observe(target, { childList: true, subtree: true, characterData: true });
  scan();
}

// Meet is a SPA: re-attach as its DOM rebuilds between screens.
attach();
setInterval(() => {
  const now = findContainer();
  if ((now && !container) || (now && container && !container.isConnected())) attach();
}, 3000);
