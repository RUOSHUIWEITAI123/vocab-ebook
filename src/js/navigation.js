/**
 * Navigation — prev/next part buttons, keyboard shortcuts.
 */

let allParts = [];

export function initNavigation(parts) {
  allParts = parts;

  // Prev/Next buttons
  document.getElementById('prev-part').addEventListener('click', goToPrevPart);
  document.getElementById('next-part').addEventListener('click', goToNextPart);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't handle if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      goToPrevPart();
    }
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      goToNextPart();
    }
  });

  // Swipe left/right on reader content (mobile)
  let touchStartX = 0;
  const readerContent = document.getElementById('reader-content');

  readerContent.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  readerContent.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    // Only trigger if significant swipe (more than 80px)
    if (Math.abs(deltaX) > 80) {
      if (deltaX > 0) {
        goToPrevPart();
      } else {
        goToNextPart();
      }
    }
  });

  // Update nav buttons state
  updateNavButtons();

  // Listen for scroll to update buttons
  readerContent.addEventListener('scroll', updateNavButtons);
}

function getCurrentPartIndex() {
  const readerContent = document.getElementById('reader-content');
  const partEls = readerContent.querySelectorAll('.part');
  let current = 0;

  for (const el of partEls) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight / 2) {
      const idx = allParts.findIndex(p => p.id === el.id);
      if (idx >= 0) current = idx;
    }
  }

  return current;
}

function goToPrevPart() {
  const idx = getCurrentPartIndex();
  if (idx > 0) {
    scrollToPart(idx - 1);
  }
}

function goToNextPart() {
  const idx = getCurrentPartIndex();
  if (idx < allParts.length - 1) {
    scrollToPart(idx + 1);
  }
}

function scrollToPart(index) {
  const part = allParts[index];
  if (!part) return;

  const el = document.getElementById(part.id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', `#${part.id}`);
  }
}

function updateNavButtons() {
  const idx = getCurrentPartIndex();
  document.getElementById('prev-part').disabled = idx <= 0;
  document.getElementById('next-part').disabled = idx >= allParts.length - 1;

  const label = document.getElementById('nav-label');
  if (label) {
    label.textContent = `${idx + 1} / ${allParts.length}`;
  }
}
