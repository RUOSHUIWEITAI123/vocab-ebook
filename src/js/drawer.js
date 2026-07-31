/**
 * Bottom drawer for vocabulary translation + sentence translation display.
 */

let vocabIndex = {};
let isVisible = false;
let isTouchDevice = false;

export function initDrawer(index) {
  vocabIndex = index;
  isTouchDevice = 'ontouchstart' in window;

  const readerContent = document.getElementById('reader-content');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('drawer');

  // Main click handler (delegated)
  readerContent.addEventListener('click', (e) => {
    // If drawer is already open and user clicks non-vocab, non-para area, close it
    if (isVisible && !e.target.closest('.vocab') && !e.target.closest('.para')) {
      hideDrawer();
      return;
    }

    // Click on vocabulary word
    const vocabEl = e.target.closest('.vocab');
    if (vocabEl) {
      e.preventDefault();
      e.stopPropagation();
      const root = vocabEl.dataset.root;
      const word = vocabEl.dataset.word;
      const contextMeaning = vocabEl.dataset.meaning;
      showVocabDrawer(root, word, contextMeaning);
      return;
    }

    // Click on English paragraph for sentence translation
    if (!isTouchDevice) {
      const paraEl = e.target.closest('.para.has-translation');
      if (paraEl) {
        const englishText = getParagraphEnglishText(paraEl);
        const chineseHtml = paraEl.dataset.translationHtml;
        if (englishText && chineseHtml) {
          if (isVisible) {
            hideDrawer();
            return;
          }
          showSentenceDrawer(englishText, chineseHtml);
          return;
        }
      }

      // "Click any word" feature — desktop only (single click)
      const word = getWordAtClick(e);
      if (word && vocabIndex[word.toLowerCase()]) {
        showVocabDrawer(word.toLowerCase(), word, null);
      }
    }
  });

  // Touch device: sentence translation on double-tap
  if (isTouchDevice) {
    let lastTap = 0;
    let lastTarget = null;
    readerContent.addEventListener('click', (e) => {
      if (e.target.closest('.vocab')) return;

      const now = Date.now();
      const sameTarget = e.target === lastTarget || e.target.closest('.para') === lastTarget?.closest('.para');

      if (now - lastTap < 400 && sameTarget) {
        // Double tap detected
        // First try: word detection
        const word = getWordAtClick(e);
        if (word && vocabIndex[word.toLowerCase()]) {
          showVocabDrawer(word.toLowerCase(), word, null);
          lastTap = 0;
          return;
        }
        // Second try: sentence translation
        const paraEl = e.target.closest('.para.has-translation');
        if (paraEl) {
          const englishText = getParagraphEnglishText(paraEl);
          const chineseHtml = paraEl.dataset.translationHtml;
          if (englishText && chineseHtml) {
            showSentenceDrawer(englishText, chineseHtml);
            lastTap = 0;
            return;
          }
        }
      }
      lastTap = now;
      lastTarget = e.target;
    });
  }

  // Close drawer via overlay
  drawerOverlay.addEventListener('click', hideDrawer);

  // Close via ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isVisible) {
      hideDrawer();
    }
  });

  // Swipe down on drawer to close
  let touchStartY = 0;
  drawer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  drawer.addEventListener('touchmove', (e) => {
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 40) {
      hideDrawer();
    }
  }, { passive: true });
}

// ── Vocabulary Drawer ────────────────────────────────────

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
      </div>
    `;
  }

  html += `
    <div class="drawer-section">
      <div class="drawer-section-label">完整释义</div>
      <ul class="drawer-meanings-list">
        ${meanings.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
      </ul>
    </div>
    <button class="drawer-speak-btn" id="drawer-speak-btn">🔊 朗读</button>
  `;

  content.innerHTML = html;

  document.getElementById('drawer-speak-btn').addEventListener('click', () => {
    speakWord(word);
  });

  show();
}

// ── Sentence Translation Drawer ──────────────────────────

function showSentenceDrawer(englishText, chineseHtml) {
  const content = document.getElementById('drawer-content');

  const html = `
    <div class="drawer-section">
      <div class="drawer-section-label">📝 原文</div>
      <div class="drawer-sentence-en">${escapeHtml(englishText)}</div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-label">🈯 译文</div>
      <div class="drawer-sentence-cn">${chineseHtml}</div>
    </div>
  `;

  content.innerHTML = html;
  show();
}

// ── Helpers ──────────────────────────────────────────────

function getParagraphEnglishText(paraEl) {
  // Get only the text content, excluding any hidden elements
  return paraEl.textContent.trim();
}

function show() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  drawer.classList.add('visible');
  overlay.classList.add('visible');
  isVisible = true;
}

function hideDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  drawer.classList.remove('visible');
  overlay.classList.remove('visible');
  isVisible = false;
}

function getWordAtClick(e) {
  if (e.target.classList.contains('vocab')) return null;

  let range;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (!pos || !pos.offsetNode || pos.offsetNode.nodeType !== Node.TEXT_NODE) return null;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  } else {
    return null;
  }

  const textNode = range.startContainer;
  const offset = range.startOffset;
  const text = textNode.textContent;

  let start = offset;
  let end = offset;
  const wordChar = /[\w'-]/;
  while (start > 0 && wordChar.test(text[start - 1])) start--;
  while (end < text.length && wordChar.test(text[end])) end++;

  const word = text.slice(start, end).trim();
  if (word.length < 2 || word.length > 30) return null;
  return word;
}

function speakWord(word) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
