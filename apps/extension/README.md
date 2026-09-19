# Decentra Meet Capture (Chrome extension)

Auto-captures Google Meet live captions and sends them through Decentra's
full pipeline — transcript → decisions, actions, questions, risks, all with
evidence pinned to the second spoken. No bots, no platform approvals.

## Install (2 min)

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `apps/extension/`.
3. Pin "Decentra capture" to the toolbar.

## Use (interview demo)

1. Click the extension → set **API URL** (local `http://localhost:8000` or
   your Railway API URL) and **Web URL**. The browser asks for host
   permission once — allow it.
2. Sign in (demo: `demo@decentra.ai / demo1234`), pick the organization.
3. Join a Google Meet, turn **captions (CC) on**.
4. **Start capture** → speak → watch lines/words count live.
5. **Stop & process** → transcript uploads as `transcript.json`, the
   pipeline runs, and you get an **Open in Decentra →** link.

## How it works

- `content.js` observes Meet's caption DOM and forwards only *new* words
  (Meet re-renders interim text; suffix diffs keep segments clean).
- `background.js` accumulates per-speaker segments with capture-relative
  timestamps, seals pauses via alarm, and on stop uploads
  `{"source": "decentra-extension", "segments": [{speaker, start, end, text}]}`
  to `POST /meetings/{id}/recording` then triggers `POST /.../process`.
- Auth mirrors the web app: Bearer access token + silent refresh on 401.

## Maintenance note (important)

Meet's caption markup changes periodically. If the line counter stays 0
while captions are visibly on, open DevTools on the Meet tab, find the
caption text element, and update `SELECTORS` in `content.js` — that object
is the only code coupled to Meet's DOM.

## Permissions rationale (for review-conscious users)

- `meet.google.com` content script: read captions, nothing else.
- `storage`: API URL + session tokens on-device.
- `tabs`: find the active Meet tab to attach capture.
- `alarms`: seal paused segments while the worker sleeps.
- API host: requested at runtime only for the URL you type
  (`optional_host_permissions`), never `<all_urls>` up front.
