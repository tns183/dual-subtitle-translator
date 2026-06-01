const toggle = document.getElementById('toggle');
const status = document.getElementById('status');
const clearBtn = document.getElementById('clearCache');
const langSelect = document.getElementById('langSelect');
const colorPicker = document.getElementById('colorPicker');

function setStatus(on) {
  status.textContent = on ? 'Enabled — subtitles will be translated' : 'Disabled';
  status.style.color = on ? '#F5821A' : '#aaa';
}

chrome.storage.local.get(['enabled', 'targetLang', 'subtitleColor'], res => {
  const on = res.enabled !== false;
  toggle.checked = on;
  setStatus(on);
  langSelect.value = res.targetLang || 'vi';
  colorPicker.value = res.subtitleColor || '#ffd54f';
});

toggle.addEventListener('change', () => {
  const on = toggle.checked;
  chrome.storage.local.set({ enabled: on });
  setStatus(on);
});

langSelect.addEventListener('change', () => {
  chrome.storage.local.set({ targetLang: langSelect.value });
});

colorPicker.addEventListener('input', () => {
  chrome.storage.local.set({ subtitleColor: colorPicker.value });
});

clearBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearCache' }, () => {
    clearBtn.textContent = 'Cleared!';
    setTimeout(() => { clearBtn.textContent = 'Clear cache'; }, 1500);
  });
});
