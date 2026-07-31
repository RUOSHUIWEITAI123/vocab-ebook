/**
 * App — tab switching, chapter navigation, word bank.
 */
import { renderPart } from './renderer.js';
import { initDrawer } from './drawer.js';
import { initTOC } from './toc.js';
import { initSettings } from './settings.js';
import { initNavigation } from './navigation.js';
import { initWordBank, getWords, getCount, removeWord, onUpdate } from './wordbank.js';

let contentData = null, vocabIndex = null, currentIndex = 0, currentDataset = 'kaoyan';

const DATASETS = {
  kaoyan: { content: '/data/content.json', vocab: '/data/vocab-index.json' },
  cet4:   { content: '/data/cet4-content.json', vocab: '/data/cet4-vocab.json' },
};

async function loadDataset(name) {
  const cfg = DATASETS[name]; if (!cfg) return;
  const c = document.getElementById('reader-content');
  c.innerHTML = '<div class="loading"><div class="spinner"></div><p>切换中...</p></div>';
  const [cRes, vRes] = await Promise.all([fetch(cfg.content), fetch(cfg.vocab)]);
  contentData = await cRes.json();
  vocabIndex = vRes.ok ? await vRes.json() : {};
  currentDataset = name;
}

function navigateToPart(index) {
  if (!contentData || index < 0 || index >= contentData.parts.length) return;
  currentIndex = index;
  const part = contentData.parts[index];
  const c = document.getElementById('reader-content'); c.innerHTML = ''; c.scrollTop = 0;
  renderPart(part, c, currentDataset);
  history.replaceState(null, '', `#${part.id}`);
  document.getElementById('current-part-label').textContent = part.partLabel || '';
  document.querySelectorAll('.toc-item').forEach((el, i) => el.classList.toggle('active', i === index));
  const prev = document.getElementById('prev-part'), next = document.getElementById('next-part');
  prev.disabled = index <= 0; next.disabled = index >= contentData.parts.length - 1;
  document.getElementById('nav-label').textContent = `${index + 1} / ${contentData.parts.length}`;
  const pct = Math.round(((index + 1) / contentData.parts.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${index + 1} / ${contentData.parts.length}`;
}

function goNext() { navigateToPart(currentIndex + 1); }
function goPrev() { navigateToPart(currentIndex - 1); }

async function switchDataset(name) {
  if (name === currentDataset) return;
  document.querySelectorAll('.top-tab').forEach(t => t.classList.toggle('active', t.dataset.dataset === name));
  // Show loading via the spinner in reader-content
  const c = document.getElementById('reader-content');
  c.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>';
  await loadDataset(name);
  currentIndex = 0;
  document.getElementById('toc-list').innerHTML = contentData.parts.map((part, i) =>
    `<button class="toc-item" data-index="${i}">${part.partLabel || 'Part ' + part.number}</button>`
  ).join('');
  navigateToPart(0);
}

// Expose to global scope for onclick
window.switchTab = (name) => switchDataset(name);

// Word Bank Panel
let reviewIndex = 0, reviewFlipped = false;
function initWordBankPanel() {
  initWordBank();
  const panel = document.getElementById('wordbank-panel'), overlay = document.getElementById('wordbank-overlay');
  function open() { panel.classList.add('visible'); overlay.classList.add('visible'); reviewIndex = 0; render(); }
  function close() { panel.classList.remove('visible'); overlay.classList.remove('visible'); }
  document.getElementById('wordbank-btn').addEventListener('click', open);
  document.getElementById('wordbank-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.querySelectorAll('.wb-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.wb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active'); render();
  }));
  onUpdate(() => { if (panel.classList.contains('visible')) render(); });
  function render() {
    const words = getWords();
    document.getElementById('wordbank-count').textContent = `(${words.length})`;
    const isReview = document.querySelector('.wb-tab.active')?.dataset.tab === 'review';
    if (isReview) {
      document.getElementById('wb-list').style.display = 'none';
      document.getElementById('wb-review').style.display = 'flex';
      if (words.length === 0) { document.getElementById('wb-review').innerHTML = '<p class="wb-empty">还没有单词</p>'; return; }
      if (reviewIndex >= words.length) {
        document.getElementById('wb-review').innerHTML = '<div class="wb-done"><p>🎉 复习完成！</p><button id="wb-restart">重新开始</button></div>';
        document.getElementById('wb-restart').onclick = () => { reviewIndex = 0; render(); };
        return;
      }
      const w = words[reviewIndex];
      document.getElementById('wb-review').innerHTML = `
        <div class="wb-card ${reviewFlipped ? 'flipped' : ''}" id="wb-card">
          <div class="wb-card-front"><div class="wb-card-word">${w.word}</div><div class="wb-card-hint">点击翻转</div></div>
          <div class="wb-card-back"><div class="wb-card-word">${w.meaning}</div></div>
        </div>
        <div class="wb-progress">${reviewIndex + 1} / ${words.length}</div>
        <div class="wb-btns"><button id="wb-forgot">😕 不认识</button><button class="primary" id="wb-know">😊 认识</button></div>`;
      document.getElementById('wb-card').onclick = () => { reviewFlipped = !reviewFlipped; document.getElementById('wb-card').classList.toggle('flipped', reviewFlipped); };
      document.getElementById('wb-know').onclick = () => { reviewIndex++; reviewFlipped = false; render(); };
      document.getElementById('wb-forgot').onclick = () => { reviewIndex++; reviewFlipped = false; render(); };
    } else {
      document.getElementById('wb-list').style.display = 'block';
      document.getElementById('wb-review').style.display = 'none';
      document.getElementById('wb-list').innerHTML = words.length === 0 ? '<p class="wb-empty">点击词汇 → 📖 加入生词本</p>' :
        words.map((w, i) => `<div class="wb-word-item"><div><strong>${w.word}</strong> <span class="wb-meaning">${w.meaning}</span></div><div class="wb-actions"><button data-action="remove" data-idx="${i}">🗑</button></div></div>`).join('');
      document.getElementById('wb-list').onclick = (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        removeWord(words[parseInt(btn.dataset.idx)].root); render();
      };
    }
  }
}

async function init() {
  // TOC click delegation (once)
  document.getElementById('toc-list').addEventListener('click', (e) => {
    const item = e.target.closest('.toc-item');
    if (item) navigateToPart(parseInt(item.dataset.index));
  });

  await loadDataset('kaoyan');
  navigateToPart(0);
  initTOC(contentData.parts, navigateToPart);
  initDrawer(vocabIndex, 'kaoyan');
  initSettings();
  initNavigation(goPrev, goNext, contentData.parts.length);
  initWordBankPanel();
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  });
}

init().catch(err => console.error('App init failed:', err));
export { navigateToPart, goNext, goPrev };
