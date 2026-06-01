const SUBTITLE_SELECTORS = [
  // Udemy
  '[data-purpose="captions-cue-text"]',
  '.captions-display--captions-cue-text--ECkFF',
  '.vjs-text-track-cue span',
  '.vjs-text-track-cue',
  '.vjs-text-track-display span',
  // YouTube
  '.ytp-caption-segment',
];

const SUBTITLE_CONTAINER_SELECTORS = [
  // Udemy
  '.vjs-text-track-display',
  '[data-purpose="captions-display"]',
  '.captions-display--captions-display--IdSsZ',
  // YouTube
  '.ytp-caption-window-container',
];

const memCache = new Map();
const MAX_CACHE = 500;
const pending = new Set();

let enabled = true;
let targetLang = 'vi';
let subtitleColor = '#ffd54f';
let subtitleObserver = null;  // watches subtitle container
let mountObserver = null;     // watches body for container to appear
let rafHandle = null;
let isApplying = false;
let observedContainer = null;

chrome.storage.local.get(['enabled', 'targetLang', 'subtitleColor'], res => {
  enabled = res.enabled !== false;
  targetLang = res.targetLang || 'vi';
  subtitleColor = res.subtitleColor || '#ffd54f';
  if (enabled) startObserving();
});

chrome.storage.onChanged.addListener(changes => {
  if ('enabled' in changes) {
    enabled = changes.enabled.newValue;
    enabled ? startObserving() : stopObserving();
  }
  if ('targetLang' in changes) {
    targetLang = changes.targetLang.newValue || 'vi';
    memCache.clear();
    pending.clear();
    // Remove cached guards so elements get re-translated in new language
    document.querySelectorAll('[data-ust-text]').forEach(el => {
      el.removeAttribute('data-ust-text');
      const vi = el.querySelector('.ust-vi');
      if (vi) vi.remove();
    });
    scheduleProcess();
  }
  if ('subtitleColor' in changes) {
    subtitleColor = changes.subtitleColor.newValue || '#ffd54f';
    document.querySelectorAll('.ust-vi').forEach(el => {
      el.style.color = subtitleColor;
    });
  }
});

// ── Observer setup ────────────────────────────────────────────────────────────

function getSubtitleContainer() {
  for (const sel of SUBTITLE_CONTAINER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function startObserving() {
  const container = getSubtitleContainer();
  if (container) {
    attachSubtitleObserver(container);
  } else {
    watchForContainerMount();
  }
}

function stopObserving() {
  if (subtitleObserver) { subtitleObserver.disconnect(); subtitleObserver = null; }
  if (mountObserver) { mountObserver.disconnect(); mountObserver = null; }
  if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  observedContainer = null;
}

function attachSubtitleObserver(container) {
  if (subtitleObserver) subtitleObserver.disconnect();
  observedContainer = container;
  subtitleObserver = new MutationObserver(onSubtitleMutation);
  subtitleObserver.observe(container, { childList: true, subtree: true, characterData: true });
  // process immediately in case subtitle is already visible
  scheduleProcess();
}

function watchForContainerMount() {
  if (mountObserver) return;
  // Fallback: watch body với characterData để không miss subtitle changes
  // Đồng thời tìm container để narrow scope khi mount xong
  mountObserver = new MutationObserver(() => {
    // Thử narrow scope nếu container đã xuất hiện
    const container = getSubtitleContainer();
    if (container && container !== observedContainer) {
      mountObserver.disconnect();
      mountObserver = null;
      attachSubtitleObserver(container);
      return;
    }
    // Chưa tìm thấy container → vẫn xử lý subtitle trực tiếp
    if (isApplying) return;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      processSubtitles();
    });
  });
  mountObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function onSubtitleMutation() {
  if (isApplying) return;
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null;
    processSubtitles();
  });
}

// ── Core logic ────────────────────────────────────────────────────────────────

function findSubtitleElements() {
  // search within observed container first for speed, fallback to document
  const root = observedContainer || document;
  for (const selector of SUBTITLE_SELECTORS) {
    const els = root.querySelectorAll(selector);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

function getOriginalText(el) {
  let text = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('ust-vi')) {
      text += node.textContent;
    }
  });
  return text.trim();
}

function scheduleProcess() {
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null;
    processSubtitles();
  });
}

function processSubtitles() {
  if (!enabled) return;

  const elements = findSubtitleElements();
  elements.forEach(el => {
    const original = getOriginalText(el);
    if (!original) return;
    if (el.dataset.ustText === targetLang + ':' + original) return;

    const cacheKey = targetLang + ':' + original;
    if (memCache.has(cacheKey)) {
      applyTranslation(el, original, memCache.get(cacheKey));
      return;
    }

    const pendingKey = targetLang + ':' + original;
    if (pending.has(pendingKey)) return;
    pending.add(pendingKey);
    try {
      chrome.runtime.sendMessage({ action: 'translate', text: original, targetLang }, res => {
        pending.delete(pendingKey);
        if (chrome.runtime.lastError) return;
        if (!res || !res.translated) return;

        cacheMemory(cacheKey, res.translated);

        // Re-find in case Udemy remounted the element
        findSubtitleElements().forEach(currentEl => {
          if (getOriginalText(currentEl) === original) {
            applyTranslation(currentEl, original, res.translated);
          }
        });
      });
    } catch {
      pending.delete(pendingKey);
    }
  });
}

function applyTranslation(el, original, translated) {
  if (!document.body.contains(el)) return;
  if (el.dataset.ustText === targetLang + ':' + original) return;

  isApplying = true;

  const existing = el.querySelector('.ust-vi');
  if (existing) {
    if (existing.textContent !== translated) existing.textContent = translated;
    existing.style.color = subtitleColor;
  } else {
    const viLine = document.createElement('span');
    viLine.className = 'ust-vi';
    viLine.textContent = translated;
    viLine.style.cssText = `display:block;color:${subtitleColor};font-size:0.95em;margin-top:2px;`;
    el.appendChild(viLine);
  }
  el.dataset.ustText = targetLang + ':' + original;

  isApplying = false;
}

function cacheMemory(key, value) {
  if (memCache.size >= MAX_CACHE) {
    memCache.delete(memCache.keys().next().value);
  }
  memCache.set(key, value);
}
