const CACHE_PREFIX = 'tr_';
const GTRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 tiếng

// In-memory cache: tránh storage.local roundtrip cho text đã dịch
const swMemCache = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslation(message.text, message.targetLang || 'vi')
      .then(translated => sendResponse({ translated }))
      .catch(() => sendResponse({ translated: message.text }));
    return true;
  }

  if (message.action === 'clearCache') {
    swMemCache.clear();
    chrome.storage.local.clear(() => sendResponse({ ok: true }));
    return true;
  }
});

async function handleTranslation(text, targetLang = 'vi') {
  if (!text || !text.trim()) return text;

  const memKey = targetLang + ':' + text;

  // 1. Check in-memory first (~0ms)
  if (swMemCache.has(memKey)) {
    const cached = swMemCache.get(memKey);
    if (cached) return cached;
    swMemCache.delete(memKey);
  }

  const cacheKey = CACHE_PREFIX + targetLang + '_' + text;

  // 2. Check storage.local (~10ms)
  const stored = await chrome.storage.local.get([cacheKey]);
  const entry = stored[cacheKey];
  if (entry && typeof entry === 'object' && entry.t && (Date.now() - entry.ts) < CACHE_TTL) {
    swMemCache.set(memKey, entry.t);
    return entry.t;
  }
  if (entry) chrome.storage.local.remove(cacheKey);

  // 3. Network call (~200-600ms, first time only)
  const url = `${GTRANSLATE_URL}?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  const translated = data[0].map(chunk => chunk[0]).join('');
  if (!translated || !translated.trim()) return text;

  swMemCache.set(memKey, translated);
  chrome.storage.local.set({ [cacheKey]: { t: translated, ts: Date.now() } });
  return translated;
}
