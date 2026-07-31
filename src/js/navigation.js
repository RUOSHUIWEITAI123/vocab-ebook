/**
 * Navigation — prev/next buttons.
 */

let goPrevFn = null;
let goNextFn = null;

export function initNavigation(goPrev, goNext, totalParts) {
  goPrevFn = goPrev;
  goNextFn = goNext;
  const total = totalParts;

  document.getElementById('prev-part').addEventListener('click', () => {
    if (goPrevFn) goPrevFn();
  });
  document.getElementById('next-part').addEventListener('click', () => {
    if (goNextFn) goNextFn();
  });

  document.getElementById('nav-label').textContent = `1 / ${total}`;
}
