/**
 * Drawer — left-click word, right-click sentence translation.
 * Supports: vocab index + 3.3M-word offline dict (on-demand) + API fallback.
 */
import { toggleWord, isInBank, initWordBank, onUpdate } from './wordbank.js';

let vocabIndex = {};
let isVisible = false;
let isTouchDevice = false;
const lookupCache = new Map();

// Lazy dict loading
const dictCache = {};
function dictLetter(w) { return /[a-z]/.test(w[0]) ? w[0] : '_'; }
async function loadDict(letter) {
  if (dictCache[letter]) return dictCache[letter];
  try {
    const r = await fetch(`/data/dict/dict-${letter}.json`);
    dictCache[letter] = r.ok ? await r.json() : {};
  } catch (e) { dictCache[letter] = {}; }
  return dictCache[letter];
}

export function initDrawer(index) {
  vocabIndex = index || {};
  isTouchDevice = 'ontouchstart' in window;
  initWordBank();
  loadDictIndex();

  const rc = document.getElementById('reader-content');
  const ov = document.getElementById('drawer-overlay');
  const dr = document.getElementById('drawer');

  // LEFT CLICK: word lookup
  rc.addEventListener('click', (e) => {
    const vocab = e.target.closest('.vocab');
    if (vocab) {
      e.preventDefault(); e.stopPropagation();
      showVocab(vocab.dataset.root, vocab.dataset.word, vocab.dataset.meaning);
      return;
    }
    if (!isTouchDevice) {
      const w = wordAtClick(e);
      if (w) { lookupWord(w); return; }
    }
    if (isVisible) hide();
  });

  // RIGHT CLICK: sentence translation
  rc.addEventListener('contextmenu', (e) => {
    const p = e.target.closest('.para.has-translation');
    if (p) {
      e.preventDefault(); e.stopPropagation();
      const en = p.textContent.trim();
      const cn = p.dataset.translationHtml;
      if (en && cn) showSentence(en, cn);
    }
  });

  // Touch: double-tap word, long-press sentence
  if (isTouchDevice) {
    let lastTap = 0, timer = null;
    rc.addEventListener('click', (e) => {
      if (e.target.closest('.vocab')) return;
      const now = Date.now();
      if (now - lastTap < 400) {
        const w = wordAtClick(e);
        if (w) lookupWord(w);
        lastTap = 0;
        return;
      }
      lastTap = now;
    });
    rc.addEventListener('touchstart', (e) => {
      const p = e.target.closest('.para.has-translation');
      if (p) timer = setTimeout(() => {
        const en = p.textContent.trim(), cn = p.dataset.translationHtml;
        if (en && cn) showSentence(en, cn);
      }, 600);
    }, { passive: true });
    rc.addEventListener('touchend', () => clearTimeout(timer));
    rc.addEventListener('touchmove', () => clearTimeout(timer));
  }

  ov.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isVisible) hide(); });
  dr.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  dr.addEventListener('touchmove', (e) => { if (e.touches[0].clientY - touchStartY > 40) hide(); }, { passive: true });
}

let touchStartY = 0;

// Word lookup flow
function lookupWord(word) {
  const lower = word.toLowerCase();
  const root = findRoot(lower);
  if (vocabIndex[lower] || root) {
    showVocab(root || lower, word, null);
    return;
  }
  // Check cache
  for (const d of Object.values(dictCache)) {
    if (d[lower]) { showOffline(word, d[lower]); return; }
  }
  // Load dict letter & retry
  loadDict(dictLetter(lower)).then(data => {
    if (data[lower]) showOffline(word, data[lower]);
    else showOnline(word);
  }).catch(() => showOnline(word));
}

// ── Drawer Views ──────────────────────────────────────
function showVocab(root, word, ctxMeaning) {
  let m = vocabIndex[root];
  if (!m) return;
  const meanings = Array.isArray(m) ? m : m.split(/[;；]/g).filter(Boolean);
  const firstMeaning = meanings[0] || '';
  let h = `<div class="drawer-word">${esc(word)}</div>`;
  if (ctxMeaning) h += `<div class="drawer-section"><div class="drawer-section-label">文中释义</div><div class="drawer-context-meaning">${esc(ctxMeaning)}</div></div>`;
  h += `<div class="drawer-section"><div class="drawer-section-label">完整释义</div><ul class="drawer-meanings-list">${meanings.map(x => `<li>${esc(x.trim())}</li>`).join('')}</ul></div>`;
  h += `<div class="drawer-actions"><button class="drawer-speak-btn" id="ds">🔊</button><button class="drawer-bank-btn" id="db" data-root="${esc(root)}" data-word="${esc(word)}" data-meaning="${esc(ctxMeaning||firstMeaning)}">${isInBank(root)?'✅已加入':'📖生词本'}</button></div>`;
  document.getElementById('drawer-content').innerHTML = h;
  document.getElementById('ds').onclick = () => speak(word);
  document.getElementById('db').onclick = function() {
    const a = toggleWord(this.dataset.word, this.dataset.root, this.dataset.meaning);
    this.textContent = a ? '✅已加入' : '📖生词本';
  };
  show();
}

function showOffline(word, meaning) {
  document.getElementById('drawer-content').innerHTML = `
    <div class="drawer-word">${esc(word)}</div>
    <div class="drawer-section"><div class="drawer-section-label">离线词典</div><div class="drawer-context-meaning">${esc(meaning)}</div></div>
    <div class="drawer-actions"><button class="drawer-speak-btn" id="ds">🔊</button><button class="drawer-bank-btn" id="db" data-root="${esc(word)}" data-word="${esc(word)}" data-meaning="${esc(meaning)}">${isInBank(word)?'✅已加入':'📖生词本'}</button></div>`;
  document.getElementById('ds').onclick = () => speak(word);
  document.getElementById('db').onclick = function() {
    this.textContent = toggleWord(this.dataset.word, this.dataset.root, this.dataset.meaning) ? '✅已加入' : '📖生词本';
  };
  show();
}

async function showOnline(word) {
  const c = document.getElementById('drawer-content');
  c.innerHTML = `<div class="drawer-word">${esc(word)}</div><div class="drawer-section"><div class="drawer-context-meaning">⏳ 查询中...</div></div>`;
  show();
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent('The word "'+word+'" means')}&langpair=en|zh`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const t = d.responseData?.translatedText?.trim() || '';
    const idx = t.indexOf('一词的意思是');
    let m = '';
    if (idx > 0) { m = t.substring(0, idx).trim(); if (m.length > 1) m = m.substring(1, m.length - 1).trim(); }
    if (m) {
      dictCache.__api = dictCache.__api || {};
      dictCache.__api[word.toLowerCase()] = m;
      showOffline(word, m);
    } else {
      c.innerHTML = `<div class="drawer-word">${esc(word)}</div><div class="drawer-section"><div class="drawer-context-meaning">未找到翻译</div></div><button class="drawer-speak-btn" id="ds">🔊</button>`;
      document.getElementById('ds').onclick = () => speak(word);
    }
  } catch (e) {
    c.innerHTML = `<div class="drawer-word">${esc(word)}</div><div class="drawer-section"><div class="drawer-context-meaning">⚠️ 网络异常</div></div><button class="drawer-speak-btn" id="ds">🔊</button>`;
    document.getElementById('ds').onclick = () => speak(word);
  }
}

function showSentence(en, cn) {
  document.getElementById('drawer-content').innerHTML = `
    <div class="drawer-section"><div class="drawer-section-label">📝 原文</div><div class="drawer-sentence-en">${esc(en)}</div></div>
    <div class="drawer-section"><div class="drawer-section-label">🈯 译文</div><div class="drawer-sentence-cn">${cn}</div></div>`;
  show();
}

// ── Helpers ──────────────────────────────────────────
function findRoot(word) {
  if (vocabIndex[word]) return word;
  const rules = [{s:'ing',r:['','e']},{s:'ed',r:['','e','d']},{s:'es',r:['','e']},{s:'s',r:['']},{s:'ied',r:['y']}];
  for (const {s,r} of rules) {
    if (word.endsWith(s)) { const st=word.slice(0,-s.length); for (const x of r) { const c=st+x; if (vocabIndex[c]) return c; } }
  }
  return null;
}

function wordAtClick(e) {
  let range;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (!pos?.offsetNode || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.setEnd(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  } else return null;
  const t = range.startContainer.textContent;
  let s = range.startOffset, e2 = s;
  while (s > 0 && /[\w'-]/.test(t[s-1])) s--;
  while (e2 < t.length && /[\w'-]/.test(t[e2])) e2++;
  const w = t.slice(s, e2).trim();
  return (w.length >= 2 && w.length <= 30) ? w : null;
}

async function loadDictIndex() {
  try {
    const r = await fetch('/data/dict/index.json');
    if (r.ok) {
      const idx = await r.json();
      const total = Object.values(idx).reduce((s, v) => s + v.count, 0);
      console.log(`📚 Dictionary: ${total} words ready`);
    }
  } catch (e) { /* */ }
}

function show() { document.getElementById('drawer').classList.add('visible'); document.getElementById('drawer-overlay').classList.add('visible'); isVisible = true; }
function hide() { document.getElementById('drawer').classList.remove('visible'); document.getElementById('drawer-overlay').classList.remove('visible'); isVisible = false; }
function speak(w) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; u.rate = 0.8; window.speechSynthesis.speak(u); } }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
