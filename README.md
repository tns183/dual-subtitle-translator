# Dual Subtitle Translator

Chrome extension that adds real-time dual subtitles (English + your language) to **Udemy** and **YouTube** videos.

![Chrome Extension](icons/icon-128.png)

---

## Installation (Developer Mode)

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the folder: `/path/to/dual-subtitle-translator`
6. The extension icon will appear in your toolbar

---

## Usage

1. Go to a Udemy or YouTube video with captions enabled
2. Click the extension icon in the toolbar
3. Toggle **Translate subtitles** to ON
4. Select your **Target language** (default: Vietnamese)
5. The translated subtitle will appear in amber color below the original

To apply code changes: click the reload icon on `chrome://extensions`, then hard-refresh the video page.

---

## Configuration

All config is done via the popup UI — no config files needed.

| Setting | Location | Description |
|---|---|---|
| Enable/Disable | Popup toggle | Turn translation on or off |
| Target language | Popup dropdown | Vietnamese, Japanese, Chinese, Korean, French, Spanish, German |
| Clear cache | Popup button | Force re-translate all subtitles |

### Change target language via popup

```
Toolbar icon → Target language → select language → done
```

---

## File Structure

```
dual-subtitle-translator/
├── manifest.json          # MV3 manifest — permissions and entry points
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── src/
    ├── content.js         # Injected into Udemy/YouTube; observes subtitle DOM
    ├── service-worker.js  # Background worker; handles translation + cache
    ├── popup.html         # Extension popup UI
    └── popup.js           # Popup logic
```

---

## Troubleshooting

**Subtitles not translating?**

Udemy changes its CSS class names with frontend deploys. Open `src/content.js` and update `SUBTITLE_SELECTORS` and `SUBTITLE_CONTAINER_SELECTORS` to match the current classes in the video page DOM.

**Translation stopped working?**

The extension uses Google Translate's unofficial endpoint (`translate.googleapis.com`). Try clicking **Clear cache** in the popup, then reload the page.

---

## Notes

- No build step — plain vanilla JS, load directly in Chrome
- Translation cache: in-memory (max 500 entries) + `chrome.storage.local` for persistence
- Uses Google Translate unofficial API (`client=gtx`) — free, no API key needed
