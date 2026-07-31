/**
 * App entry point — loads content, initializes all modules.
 */
import { renderAllParts } from './renderer.js';
import { initDrawer } from './drawer.js';
import { initTOC, updateTOC } from './toc.js';
import { initSettings } from './settings.js';
import { initNavigation } from './navigation.js';

// Global state
let contentData = null;
let vocabularyIndex = null;

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

async function init() {
  // Load data
  await loadData();

  // Hide loading
  document.getElementById('loading').style.display = 'none';

  // Render content
  const container = document.getElementById('reader-content');
  renderAllParts(contentData.parts, container);

  // Initialize modules
  initTOC(contentData.parts);
  initDrawer(vocabularyIndex);
  initSettings();
  initNavigation(contentData.parts);

  // Hash navigation
  const hash = window.location.hash;
  if (hash) {
    setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }
}

// Start
init().catch(err => {
  console.error('App init failed:', err);
});

export { getContentData, getVocabIndex };
