/**
 * App entry point — loads content, manages chapter navigation.
 */
import { renderPart } from './renderer.js';
import { initDrawer } from './drawer.js';
import { initTOC, updateTOC } from './toc.js';
import { initSettings } from './settings.js';
import { initNavigation } from './navigation.js';

// Global state
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

/** Navigate to a specific part */
function navigateToPart(index) {
  if (!contentData || index < 0 || index >= contentData.parts.length) return;
  currentIndex = index;

  const part = contentData.parts[index];
  const container = document.getElementById('reader-content');
  container.innerHTML = '';
  container.scrollTop = 0;
  renderPart(part, container);

  // Update URL hash
  history.replaceState(null, '', `#${part.id}`);

  // Update toolbar
  document.getElementById('current-part-label').textContent =
    part.partLabel || `Part ${part.number}`;

  // Update TOC highlight
  updateTOC(index);

  // Update nav buttons
  document.getElementById('prev-part').disabled = index <= 0;
  document.getElementById('next-part').disabled = index >= contentData.parts.length - 1;
  document.getElementById('nav-label').textContent =
    `${index + 1} / ${contentData.parts.length}`;

  // Update progress
  const pct = Math.round(((index + 1) / contentData.parts.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    `${index + 1} / ${contentData.parts.length}`;

  // Scroll content to top
  container.scrollTop = 0;
}

/** Go to prev/next */
function goNext() { navigateToPart(currentIndex + 1); }
function goPrev() { navigateToPart(currentIndex - 1); }

async function init() {
  await loadData();

  document.getElementById('loading').style.display = 'none';

  // Determine starting chapter from URL hash
  const hash = window.location.hash;
  let startIndex = 0;
  if (hash) {
    const partId = hash.replace('#', '');
    const idx = contentData.parts.findIndex(p => p.id === partId);
    if (idx >= 0) startIndex = idx;
  }

  // Render first chapter
  navigateToPart(startIndex);

  // Initialize modules
  initTOC(contentData.parts, navigateToPart);
  initDrawer(vocabularyIndex);
  initSettings();
  initNavigation(goPrev, goNext, contentData.parts.length);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goNext(); }
  });

  // Swipe navigation (mobile)
  let touchStartX = 0;
  const readerContent = document.getElementById('reader-content');
  readerContent.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  readerContent.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 80) {
      deltaX > 0 ? goPrev() : goNext();
    }
  });
}

init().catch(err => {
  console.error('App init failed:', err);
});

export { getContentData, getVocabIndex, getCurrentIndex, navigateToPart, goNext, goPrev };
