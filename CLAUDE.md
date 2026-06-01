# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension that adds real-time Vietnamese dual subtitles to Udemy and YouTube videos. There is no build step — the extension is loaded directly from the repo directory in Chrome's developer mode.

## Loading / testing the extension

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Navigate to a Udemy or YouTube video with captions enabled
5. After any code change, click the reload icon on `chrome://extensions` for the extension, then hard-refresh the video page

There are no automated tests; verification is manual in the browser.

## Architecture

```
manifest.json          — MV3 manifest; declares permissions and entry points
src/content.js         — Injected into Udemy/YouTube pages; observes subtitle DOM and injects Vietnamese lines
src/service-worker.js  — Background worker; handles translation requests and two-level cache
src/popup.html/.js     — Browser-action popup; toggle on/off and clear cache
icons/                 — Extension icons
```

### Translation flow

1. `content.js` uses two `MutationObserver`s: `subtitleObserver` watches the subtitle container once found; `mountObserver` watches `document.body` until the container mounts.
2. On subtitle change, it calls `processSubtitles()` via `requestAnimationFrame` (debounced, guarded by `isApplying`).
3. Cache hit (in-memory `memCache`, max 500 entries, LRU-evict oldest) → apply immediately; cache miss → `chrome.runtime.sendMessage({ action: 'translate', text })`.
4. `service-worker.js` checks its own in-memory `swMemCache`, then `chrome.storage.local` (key prefix `tr_`), then fetches Google Translate's unofficial endpoint (`translate.googleapis.com/translate_a/single?client=gtx`).
5. `applyTranslation()` appends a `<span class="ust-vi">` with amber text (`#ffd54f`) below the English line. `el.dataset.ustText` guards against duplicate injection.

### Subtitle selectors

`SUBTITLE_SELECTORS` and `SUBTITLE_CONTAINER_SELECTORS` in `content.js` are Udemy-specific CSS class names that change with frontend deploys. When subtitles stop working, these selectors are the first thing to check and update.

## Key constraints

- **No build tooling** — plain vanilla JS, no npm, no bundler. Keep it that way.
- **MV3 service worker lifecycle** — the service worker can be terminated between messages; `swMemCache` will be lost. `chrome.storage.local` is the durable cache layer.
- **`host_permissions`** must include `https://translate.googleapis.com/*` for the fetch to work from the service worker.
- The Google Translate endpoint used (`client=gtx`) is unofficial and rate-limit-free for low volume but not guaranteed to remain stable.
