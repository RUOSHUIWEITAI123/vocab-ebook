/**
 * Bottom drawer for vocabulary translation + sentence translation display.
 * Supports: 580-word local index + online translation API for any word.
 */
import { toggleWord, isInBank, initWordBank, onUpdate } from './wordbank.js';

let vocabIndex = {};
let extraDict = {};
let isVisible = false;
let isTouchDevice = false;
let currentDataset = 'kaoyan';

// Cache for API lookups (persisted to localStorage)
const lookupCache = new Map();

export function initDrawer(index, dataset) {
  vocabIndex = index || {};
  isTouchDevice = 'ontouchstart' in window;
  initWordBank();
  currentDataset = dataset || 'kaoyan';

  // Load offline extra dictionary
  loadExtraDict();

  // Load persisted API cache
  try {
    const saved = JSON.parse(localStorage.getItem('vocab-lookup-cache') || '{}');
    for (const [k, v] of Object.entries(saved)) {
      lookupCache.set(k, v);
    }
  } catch (e) { /* ignore */ }

  const readerContent = document.getElementById('reader-content');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('drawer');

  // LEFT CLICK: word translation
  readerContent.addEventListener('click', (e) => {
    // Click on green vocab word → vocab drawer
    const vocabEl = e.target.closest('.vocab');
    if (vocabEl) {
      e.preventDefault();
      e.stopPropagation();
      showVocabDrawer(vocabEl.dataset.root, vocabEl.dataset.word, vocabEl.dataset.meaning);
      return;
    }

    // Click on text → word lookup
    if (!isTouchDevice) {
      const word = getWordAtClick(e);
      if (word) {
        const lower = word.toLowerCase();
        // Check vocab index
        const root = findRootInIndex(lower);
        if (vocabIndex[lower] || root) {
          showVocabDrawer(root || lower, word, null);
          return;
        }
        // Check offline dictionary
        const off = lookupOffline(word);
        if (off) { showOfflineDrawer(word, off.meaning); return; }
        // Online lookup
        showLookupDrawer(word);
        return;
      }
    }

    // Close drawer if clicking empty area
    if (isVisible) hideDrawer();
  });

  // RIGHT CLICK: sentence translation
  readerContent.addEventListener('contextmenu', (e) => {
    const paraEl = e.target.closest('.para.has-translation');
    if (paraEl) {
      e.preventDefault();
      e.stopPropagation();
      const englishText = getParagraphEnglishText(paraEl);
      const chineseHtml = paraEl.dataset.translationHtml;
      if (englishText && chineseHtml) {
        showSentenceDrawer(englishText, chineseHtml);
      }
    }
  });

  // Touch: double-tap = word, long-press = sentence
  if (isTouchDevice) {
    let lastTap = 0;
    let longPressTimer = null;

    readerContent.addEventListener('click', (e) => {
      if (e.target.closest('.vocab')) return;
      const now = Date.now();
      if (now - lastTap < 400) {
        const word = getWordAtClick(e);
        if (word) {
          const lower = word.toLowerCase();
          if (vocabIndex[lower] || findRootInIndex(lower)) {
            showVocabDrawer(findRootInIndex(lower) || lower, word, null);
          } else {
            const off = lookupOffline(word);
            off ? showOfflineDrawer(word, off.meaning) : showLookupDrawer(word);
          }
        }
        lastTap = 0;
        return;
      }
      lastTap = now;
    });

    readerContent.addEventListener('touchstart', (e) => {
      const paraEl = e.target.closest('.para.has-translation');
      if (paraEl) {
        longPressTimer = setTimeout(() => {
          const englishText = getParagraphEnglishText(paraEl);
          const chineseHtml = paraEl.dataset.translationHtml;
          if (englishText && chineseHtml) showSentenceDrawer(englishText, chineseHtml);
        }, 600);
      }
    }, { passive: true });
    readerContent.addEventListener('touchend', () => clearTimeout(longPressTimer));
    readerContent.addEventListener('touchmove', () => clearTimeout(longPressTimer));
  }

  // Close drawer via overlay
  drawerOverlay.addEventListener('click', hideDrawer);

  // Close via ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isVisible) hideDrawer();
  });

  // Swipe down on drawer to close
  let touchStartY = 0;
  drawer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  drawer.addEventListener('touchmove', (e) => {
    if (e.touches[0].clientY - touchStartY > 40) hideDrawer();
  }, { passive: true });
}

// ── Vocab Drawer (580-word index) ───────────────────────

function showVocabDrawer(root, word, contextMeaning) {
  const meanings = vocabIndex[root];
  if (!meanings || meanings.length === 0) return;

  const content = document.getElementById('drawer-content');
  let html = `<div class="drawer-word">${escapeHtml(word)}</div>`;

  if (contextMeaning) {
    html += `
      <div class="drawer-section">
        <div class="drawer-section-label">文中释义</div>
        <div class="drawer-context-meaning">${escapeHtml(contextMeaning)}</div>
      </div>`;
  }

  html += `
    <div class="drawer-section">
      <div class="drawer-section-label">完整释义（580词表）</div>
      <ul class="drawer-meanings-list">
        ${meanings.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
      </ul>
    </div>
    <div class="drawer-actions">
      <button class="drawer-speak-btn" id="drawer-speak-btn">🔊 朗读</button>
      <button class="drawer-bank-btn" id="drawer-bank-btn" data-root="${escapeHtml(root)}" data-word="${escapeHtml(word)}" data-meaning="${escapeHtml(contextMeaning || meanings[0] || '')}">
        ${isInBankLocal(root) ? '✅ 已加入' : '📖 加入生词本'}
      </button>
    </div>`;

  content.innerHTML = html;
  document.getElementById('drawer-speak-btn').addEventListener('click', () => speakWord(word));
  const bankBtn = document.getElementById('drawer-bank-btn');
  if (bankBtn) {
    bankBtn.addEventListener('click', () => {
      const added = toggleWord(bankBtn.dataset.word, bankBtn.dataset.root, bankBtn.dataset.meaning);
      bankBtn.textContent = added ? '✅ 已加入' : '📖 加入生词本';
    });
  }
  show();
}

// ── Offline Dictionary Drawer ────────────────────────────

function showOfflineDrawer(word, meaning) {
  const content = document.getElementById('drawer-content');
  content.innerHTML = `
    <div class="drawer-word">${escapeHtml(word)}</div>
    <div class="drawer-section">
      <div class="drawer-section-label">离线词典</div>
      <div class="drawer-context-meaning">${escapeHtml(meaning)}</div>
    </div>
    <div class="drawer-section" style="margin-top:4px;">
      <div class="drawer-section-label" style="font-size:0.7rem;color:var(--text-secondary);">（来自内置词库，无需联网）</div>
    </div>
    <div class="drawer-actions">
      <button class="drawer-speak-btn" id="drawer-speak-btn">🔊 朗读</button>
      <button class="drawer-bank-btn" id="drawer-bank-btn" data-root="${escapeHtml(word)}" data-word="${escapeHtml(word)}" data-meaning="${escapeHtml(meaning)}">
        ${isInBankLocal(word) ? '✅ 已加入' : '📖 加入生词本'}
      </button>
    </div>`;
  document.getElementById('drawer-speak-btn').addEventListener('click', () => speakWord(word));
  document.getElementById('drawer-bank-btn').addEventListener('click', function() {
    const added = toggleWord(this.dataset.word, this.dataset.root, this.dataset.meaning);
    this.textContent = added ? '✅ 已加入' : '📖 加入生词本';
  });
  show();
}

// ── Online Lookup Drawer (any word) ──────────────────────

async function showLookupDrawer(word) {
  const content = document.getElementById('drawer-content');
  const lower = word.toLowerCase().trim();

  // Show loading
  content.innerHTML = `
    <div class="drawer-word">${escapeHtml(word)}</div>
    <div class="drawer-section">
      <div class="drawer-section-label">查询中...</div>
      <div class="drawer-context-meaning" style="text-align:center;color:var(--text-secondary);">⏳ 正在获取翻译</div>
    </div>`;
  show();

  // Check cache first
  if (lookupCache.has(lower)) {
    renderLookupResult(word, lookupCache.get(lower));
    return;
  }

  // Try online API
  try {
    const result = await fetchTranslation(lower);
    lookupCache.set(lower, result);
    persistCache();
    renderLookupResult(word, result);
  } catch (err) {
    renderLookupError(word, err.message);
  }
}

async function fetchTranslation(word) {
  // Use MyMemory API with context wrapping for better single-word accuracy
  const query = `The word "${word}" means`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|zh`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) throw new Error('网络异常');
  const data = await resp.json();

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const translated = data.responseData.translatedText.trim();
    // Format: “X”一词的意思是 → extract X
    const idx = translated.indexOf('一词的意思是'); // 一词的意思是
    let result = '';
    if (idx > 0) {
      result = translated.substring(0, idx).trim();
      // Strip surrounding quote characters
      if (result.length > 1) {
        result = result.substring(1, result.length - 1).trim();
      }
    }
    if (!result && translated.length < 15) {
      result = translated;
    }
    if (result && result.length < 20) {
      return { translation: result, match: data.responseData.match || 0 };
    }
    // Fallback: use raw translation if clean and short
    if (translated.toLowerCase() !== word.toLowerCase() && translated.length < 20) {
      return { translation: translated, match: data.responseData.match || 0 };
    }
    return { translation: null, note: '未找到准确翻译' };
  }

  throw new Error('未找到翻译');
}

function renderLookupResult(word, result) {
  const content = document.getElementById('drawer-content');
  let html = `<div class="drawer-word">${escapeHtml(word)}</div>`;

  if (result.translation) {
    html += `
      <div class="drawer-section">
        <div class="drawer-section-label">中文翻译</div>
        <div class="drawer-context-meaning">${escapeHtml(result.translation)}</div>
      </div>`;
    if (result.match !== undefined && result.match < 0.8) {
      html += `<div class="drawer-section" style="font-size:0.7rem;color:var(--text-secondary);margin-top:-8px;">匹配度: ${Math.round(result.match * 100)}% (仅供参考)</div>`;
    }
  } else if (result.note) {
    html += `
      <div class="drawer-section">
        <div class="drawer-context-meaning" style="color:var(--text-secondary);">${escapeHtml(result.note)}</div>
      </div>`;
  }

  html += `
    <div class="drawer-section" style="margin-top:8px;">
      <div class="drawer-section-label" style="font-size:0.7rem;color:var(--text-secondary);">（该词不在580词表中）</div>
    </div>
    <div class="drawer-actions">
      <button class="drawer-speak-btn" id="drawer-speak-btn">🔊 朗读</button>
      <button class="drawer-bank-btn" id="drawer-bank-btn" data-root="${escapeHtml(word)}" data-word="${escapeHtml(word)}" data-meaning="${escapeHtml(result.translation || '')}">
        ${isInBankLocal(word) ? '✅ 已加入' : '📖 加入生词本'}
      </button>
    </div>`;

  content.innerHTML = html;
  const speakBtn = document.getElementById('drawer-speak-btn');
  if (speakBtn) speakBtn.addEventListener('click', () => speakWord(word));
  const bankBtn = document.getElementById('drawer-bank-btn');
  if (bankBtn) {
    bankBtn.addEventListener('click', function() {
      const added = toggleWord(this.dataset.word, this.dataset.root, this.dataset.meaning);
      this.textContent = added ? '✅ 已加入' : '📖 加入生词本';
    });
  }
}

function renderLookupError(word, msg) {
  const content = document.getElementById('drawer-content');
  content.innerHTML = `
    <div class="drawer-word">${escapeHtml(word)}</div>
    <div class="drawer-section">
      <div class="drawer-context-meaning" style="color:var(--text-secondary);">
        ⚠️ 翻译服务暂不可用（${escapeHtml(msg)}）<br>
        <small>请检查网络连接后重试</small>
      </div>
    </div>
    <button class="drawer-speak-btn" id="drawer-speak-btn">🔊 朗读</button>`;
  const speakBtn = document.getElementById('drawer-speak-btn');
  if (speakBtn) speakBtn.addEventListener('click', () => speakWord(word));
}

// ── Sentence Translation Drawer ──────────────────────────

function showSentenceDrawer(englishText, chineseHtml) {
  const content = document.getElementById('drawer-content');
  content.innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-label">📝 原文</div>
      <div class="drawer-sentence-en">${escapeHtml(englishText)}</div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-label">🈯 译文</div>
      <div class="drawer-sentence-cn">${chineseHtml}</div>
    </div>`;
  show();
}

// ── Helpers ──────────────────────────────────────────────

async function loadExtraDict() {
  try {
    const resp = await fetch('/data/extra-dict.json');
    if (resp.ok) {
      extraDict = await resp.json();
      console.log(`📚 Offline dictionary loaded: ${Object.keys(extraDict).length} words`);
    }
  } catch (e) {
    console.log('Offline dictionary not available, using API fallback');
  }
}

/** Look up word in offline dict, return meaning or null */
function lookupOffline(word) {
  const lower = word.toLowerCase().trim();
  // Check 580-word index first
  const root = findRootInIndex(lower);
  if (root) return { meaning: (vocabIndex[root] || [''])[0], source: '580词表' };
  // Check extra dictionary
  if (extraDict[lower]) return { meaning: extraDict[lower], source: '离线词典' };
  return null;
}

function findRootInIndex(word) {
  if (vocabIndex[word]) return word;
  const rules = [
    { suffix: 'ing', replace: ['', 'e'] },
    { suffix: 'ed', replace: ['', 'e', 'd'] },
    { suffix: 'es', replace: ['', 'e'] },
    { suffix: 's', replace: [''] },
    { suffix: 'ied', replace: ['y'] },
  ];
  for (const rule of rules) {
    if (word.endsWith(rule.suffix)) {
      const stem = word.slice(0, -rule.suffix.length);
      for (const repl of rule.replace) {
        const c = stem + repl;
        if (vocabIndex[c]) return c;
      }
    }
  }
  return null;
}

function getParagraphEnglishText(paraEl) {
  return paraEl.textContent.trim();
}

function getWordAtClick(e) {
  let range;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (!pos?.offsetNode || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  } else {
    return null;
  }

  const text = range.startContainer.textContent;
  const offset = range.startOffset;
  let start = offset, end = offset;
  const wordChar = /[\w'-]/;
  while (start > 0 && wordChar.test(text[start - 1])) start--;
  while (end < text.length && wordChar.test(text[end])) end++;

  const word = text.slice(start, end).trim();
  if (word.length < 2 || word.length > 30) return null;
  return word;
}

function persistCache() {
  try {
    const obj = {};
    // Only persist last 200 lookups
    const entries = [...lookupCache.entries()].slice(-200);
    for (const [k, v] of entries) obj[k] = v;
    localStorage.setItem('vocab-lookup-cache', JSON.stringify(obj));
  } catch (e) { /* ignore */ }
}

function show() {
  document.getElementById('drawer').classList.add('visible');
  document.getElementById('drawer-overlay').classList.add('visible');
  isVisible = true;
}

function hideDrawer() {
  document.getElementById('drawer').classList.remove('visible');
  document.getElementById('drawer-overlay').classList.remove('visible');
  isVisible = false;
}

function speakWord(word) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
  }
}

function isInBankLocal(root) { return isInBank(root); }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
