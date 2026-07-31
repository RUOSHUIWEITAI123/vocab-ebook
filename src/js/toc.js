/**
 * Table of Contents — chapter list, highlights current.
 */

let allParts = [];
let onNavigate = null;

export function initTOC(parts, navigateFn) {
  allParts = parts;
  onNavigate = navigateFn;

  const tocList = document.getElementById('toc-list');
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('drawer-overlay');

  // Render TOC items
  tocList.innerHTML = parts.map((part, i) => `
    <button class="toc-item" data-index="${i}">
      ${part.partLabel || `Part ${part.number}`}
    </button>
  `).join('');

  // Click handler
  tocList.addEventListener('click', (e) => {
    const item = e.target.closest('.toc-item');
    if (!item) return;
    const index = parseInt(item.dataset.index);
    if (onNavigate) onNavigate(index);
    if (window.innerWidth <= 768) closeSidebar();
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

  // Overlay click closes sidebar on mobile
  overlay.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
  });
}

export function updateTOC(currentIndex) {
  const items = document.querySelectorAll('.toc-item');
  items.forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.index) === currentIndex);
  });

  // Ensure the active item is visible in the scrollable list
  const activeItem = items[currentIndex];
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
}
