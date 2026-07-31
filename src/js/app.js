/**
 * App entry point — loads content, manages chapter navigation, word bank.
 */
import { renderPart } from './renderer.js';
import { initDrawer } from './drawer.js';
import { initTOC, updateTOC } from './toc.js';
import { initSettings } from './settings.js';
import { initNavigation } from './navigation.js';
import { initWordBank, getWords, getCount, removeWord, onUpdate } from './wordbank.js';

let contentData = null;
let vocabularyIndex = null;
let currentIndex = 0;

async function loadData() {
  try {
    const [contentRes, vocabRes] = await Promise.all([
      fetch('/data/content.json'),
      fetch('/data/vocab-index.json'),
    ]);
    if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
    if (!vocabRes.ok) throw new Error(`HTTP ${vocabRes.status}`);
    contentData = await contentRes.json();
    vocabularyIndex = await vocabRes.json();
  } catch (err) {
    console.error('Failed to load content:', err);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    throw err;
  }
}

function getContentData() { return contentData; }
function getVocabIndex() { return vocabularyIndex; }
function getCurrentIndex() { return currentIndex; }

function navigateToPart(index) {
  if (!contentData || index < 0 || index >= contentData.parts.length) return;
  currentIndex = index;
  const part = contentData.parts[index];
  const container = document.getElementById('reader-content');
  container.innerHTML = '';
  container.scrollTop = 0;
  renderPart(part, container);
  history.replaceState(null, '', `#${part.id}`);
  document.getElementById('current-part-label').textContent = part.partLabel || `Part ${part.number}`;
  updateTOC(index);
  document.getElementById('prev-part').disabled = index <= 0;
  document.getElementById('next-part').disabled = index >= contentData.parts.length - 1;
  document.getElementById('nav-label').textContent = `${index + 1} / ${contentData.parts.length}`;
  const pct = Math.round(((index + 1) / contentData.parts.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${index + 1} / ${contentData.parts.length}`;
}

function goNext() { navigateToPart(currentIndex + 1); }
function goPrev() { navigateToPart(currentIndex - 1); }

function findWordInContent(word, root) {
  if (!contentData) return;
  for (let i = 0; i < contentData.parts.length; i++) {
    for (const section of contentData.parts[i].sections) {
      if (section.type === 'english' || section.type === 'chinese') {
        for (const para of section.paragraphs) {
          for (const seg of para.segments) {
            if (seg.type === 'vocab' && (seg.root === root || seg.word === word)) {
              navigateToPart(i);
              setTimeout(() => {
                const el = document.querySelector(`.vocab[data-root="${root}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
              return;
            }
          }
        }
      }
    }
  }
}

// ── Word Bank Panel ────────────────────────────────────
let reviewIndex = 0;
let reviewFlipped = false;

function initWordBankPanel() {
  initWordBank();
  const panel = document.getElementById('wordbank-panel');
  const overlay = document.getElementById('wordbank-overlay');

  function open() {
    panel.classList.add('visible'); overlay.classList.add('visible');
    reviewIndex = 0; reviewFlipped = false;
    document.querySelectorAll('.wb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.wb-tab[data-tab="list"]')?.classList.add('active');
    render();
  }
  function close() { panel.classList.remove('visible'); overlay.classList.remove('visible'); }

  document.getElementById('wordbank-btn').addEventListener('click', open);
  document.getElementById('wordbank-close').addEventListener('click', close);
  overlay.addEventListener('click', close);

  document.querySelectorAll('.wb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      render();
    });
  });

  onUpdate(() => { if (panel.classList.contains('visible')) render(); });

  function render() {
    const words = getWords();
    document.getElementById('wordbank-count').textContent = `(${words.length})`;
    const isReview = document.querySelector('.wb-tab.active')?.dataset.tab === 'review';
    if (isReview) renderReview(words); else renderList(words);
  }

  function renderList(words) {
    document.getElementById('wb-list').style.display = 'block';
    document.getElementById('wb-review').style.display = 'none';
    if (words.length === 0) {
      document.getElementById('wb-list').innerHTML = '<p class="wb-empty">点击文章中的词汇 → 📖 加入生词本</p>';
      return;
    }
    document.getElementById('wb-list').innerHTML = words.map((w, i) => `
      <div class="wb-word-item">
        <div><strong>${w.word}</strong> <span class="wb-meaning">${w.meaning}</span></div>
        <div class="wb-actions">
          <button data-action="context" data-idx="${i}">📖</button>
          <button data-action="remove" data-idx="${i}">🗑</button>
        </div>
      </div>
    `).join('');
    document.getElementById('wb-list').onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const i = parseInt(btn.dataset.idx);
      if (btn.dataset.action === 'remove') { removeWord(words[i].root); render(); }
      else if (btn.dataset.action === 'context') { findWordInContent(words[i].word, words[i].root); close(); }
    };
  }

  function renderReview(words) {
    document.getElementById('wb-list').style.display = 'none';
    document.getElementById('wb-review').style.display = 'flex';
    if (words.length === 0) {
      document.getElementById('wb-review').innerHTML = '<p class="wb-empty">还没有单词</p>';
      return;
    }
    if (reviewIndex >= words.length) {
      document.getElementById('wb-review').innerHTML = `
        <div class="wb-done"><p>🎉 复习完成！</p><button id="wb-restart">重新开始</button></div>`;
      document.getElementById('wb-restart').onclick = () => { reviewIndex = 0; renderReview(words); };
      return;
    }
    const w = words[reviewIndex];
    document.getElementById('wb-review').innerHTML = `
      <div class="wb-card ${reviewFlipped ? 'flipped' : ''}" id="wb-card">
        <div class="wb-card-front"><div class="wb-card-word">${w.word}</div><div class="wb-card-hint">点击翻转</div></div>
        <div class="wb-card-back"><div class="wb-card-word">${w.meaning}</div></div>
      </div>
      <div class="wb-progress">${reviewIndex + 1} / ${words.length}</div>
      <div class="wb-btns">
        <button id="wb-forgot">😕 不认识</button>
        <button class="primary" id="wb-know">😊 认识</button>
      </div>`;
    document.getElementById('wb-card').onclick = () => {
      reviewFlipped = !reviewFlipped;
      document.getElementById('wb-card').classList.toggle('flipped', reviewFlipped);
    };
    document.getElementById('wb-know').onclick = () => { reviewIndex++; reviewFlipped = false; renderReview(words); };
    document.getElementById('wb-forgot').onclick = () => { reviewIndex++; reviewFlipped = false; renderReview(words); };
  }
}

// ── Init ──────────────────────────────────────────────
async function init() {
  await loadData();
  document.getElementById('loading').style.display = 'none';

  const hash = window.location.hash;
  let startIndex = 0;
  if (hash) {
    const partId = hash.replace('#', '');
    const idx = contentData.parts.findIndex(p => p.id === partId);
    if (idx >= 0) startIndex = idx;
  }

  navigateToPart(startIndex);
  initTOC(contentData.parts, navigateToPart);
  initDrawer(vocabularyIndex);
  initSettings();
  initNavigation(goPrev, goNext, contentData.parts.length);
  initWordBankPanel();

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goNext(); }
  });

  let touchStartX = 0;
  const rc = document.getElementById('reader-content');
  rc.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  rc.addEventListener('touchend', (e) => {
    if (Math.abs(e.changedTouches[0].clientX - touchStartX) > 80) {
      e.changedTouches[0].clientX > touchStartX ? goPrev() : goNext();
    }
  });
}

init().catch(err => console.error('App init failed:', err));
