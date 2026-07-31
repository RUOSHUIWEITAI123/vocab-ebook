/**
 * Table of Contents — renders part list, scroll-spy.
 */

let allParts = [];

export function initTOC(parts) {
  allParts = parts;

  const tocList = document.getElementById('toc-list');
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('drawer-overlay');

  // Render TOC items
  tocList.innerHTML = parts.map((part, i) => `
    <button class="toc-item" data-part-id="${part.id}" data-index="${i}">
      ${part.partLabel || `Part ${part.number}`}
    </button>
  `).join('');

  // Click handler
  tocList.addEventListener('click', (e) => {
    const item = e.target.closest('.toc-item');
    if (!item) return;

    const partId = item.dataset.partId;
    const el = document.getElementById(partId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      // Update URL hash (without triggering scroll)
      history.replaceState(null, '', `#${partId}`);
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  });

  // Overlay click to close sidebar on mobile
  overlay.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Scroll-spy: highlight current part
  const readerContent = document.getElementById('reader-content');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        updateActiveTOC(entry.target.id);
      }
    }
  }, {
    root: readerContent,
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0,
  });

  // Observe all part elements
  setTimeout(() => {
    for (const part of parts) {
      const el = document.getElementById(part.id);
      if (el) observer.observe(el);
    }
  }, 500);

  // Update progress
  updateProgress();
  readerContent.addEventListener('scroll', updateProgress);
}

function updateActiveTOC(partId) {
  const items = document.querySelectorAll('.toc-item');
  items.forEach(item => {
    item.classList.toggle('active', item.dataset.partId === partId);
  });

  // Update toolbar label
  const label = document.getElementById('current-part-label');
  const part = allParts.find(p => p.id === partId);
  if (part && label) {
    label.textContent = part.partLabel || `Part ${part.number}`;
  }

  // Update nav label
  const navLabel = document.getElementById('nav-label');
  if (part && navLabel) {
    navLabel.textContent = `${part.number} / ${allParts.length}`;
  }
}

function updateProgress() {
  const readerContent = document.getElementById('reader-content');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  const scrollTop = readerContent.scrollTop;
  const scrollHeight = readerContent.scrollHeight - readerContent.clientHeight;

  if (scrollHeight > 0) {
    const pct = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
    progressBar.style.width = pct + '%';
  }

  // Find current part for text
  const partEls = readerContent.querySelectorAll('.part');
  let current = 1;
  for (const el of partEls) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= 150) {
      const part = allParts.find(p => p.id === el.id);
      if (part) current = part.number;
    }
  }
  progressText.textContent = `${current} / ${allParts.length}`;
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
}

export function updateTOC(currentIndex) {
  updateActiveTOC(allParts[currentIndex]?.id);
}
