/**
 * Renderer — converts structured JSON parts into DOM elements.
 * Also links English paragraphs to their Chinese translations.
 */

/**
 * Render all parts into the container.
 */
export function renderAllParts(parts, container) {
  const fragment = document.createDocumentFragment();
  for (const part of parts) {
    const partEl = renderPart(part);
    fragment.appendChild(partEl);
  }
  container.appendChild(fragment);

  // Post-process: link English paragraphs to Chinese translations
  linkTranslations(container);
}

/**
 * Convert a Chinese paragraph DOM to formatted HTML:
 * Regular text → as-is
 * Vocab spans → <strong>meaning</strong>(word)
 */
function formatChineseTranslation(chinesePara) {
  let html = '';
  for (const child of chinesePara.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      html += escapeHtml(child.textContent);
    } else if (child.classList && child.classList.contains('vocab')) {
      const word = child.dataset.word || '';
      const meaning = child.dataset.meaning || word;
      html += `<strong>${escapeHtml(meaning)}</strong>(${escapeHtml(word)})`;
    } else if (child.classList && child.classList.contains('text')) {
      html += escapeHtml(child.textContent);
    } else {
      html += escapeHtml(child.textContent || '');
    }
  }
  return html;
}

/**
 * After rendering, walk through each part and link English paragraphs
 * to their corresponding Chinese translations.
 */
function linkTranslations(container) {
  const partEls = container.querySelectorAll('.part');
  for (const partEl of partEls) {
    // Collect all English paragraphs and Chinese paragraphs in order
    const englishParas = [];
    const chineseParas = [];

    const sections = partEl.querySelectorAll(':scope > .section');
    for (const section of sections) {
      const type = section.dataset.sectionType;
      const paras = section.querySelectorAll('.para');
      for (const para of paras) {
        if (type === 'english') {
          englishParas.push(para);
        } else if (type === 'chinese') {
          chineseParas.push(para);
        }
      }
    }

    // Pair by position: English[i] ↔ Chinese[i]
    const count = Math.min(englishParas.length, chineseParas.length);
    for (let i = 0; i < count; i++) {
      const chineseHtml = formatChineseTranslation(chineseParas[i]);
      if (chineseHtml) {
        englishParas[i].dataset.translationHtml = chineseHtml;
        englishParas[i].classList.add('has-translation');
      }
    }
  }
}

/**
 * Render a single part.
 */
function renderPart(part) {
  const el = document.createElement('section');
  el.className = 'part';
  el.id = part.id;

  // Header
  const header = document.createElement('div');
  header.className = 'part-header';
  header.innerHTML = `<h2>${escapeHtml(part.title)}</h2>`;
  el.appendChild(header);

  // Sections
  for (const section of part.sections) {
    const sectionEl = renderSection(section);
    if (sectionEl) {
      el.appendChild(sectionEl);
    }
  }

  return el;
}

/**
 * Render a section (english, chinese, or grammar-notes).
 */
function renderSection(section) {
  if (section.type === 'grammar-notes') {
    return renderGrammarNotes(section.notes);
  }

  const div = document.createElement('div');
  div.className = `section section-${section.type}`;
  div.dataset.sectionType = section.type;

  for (const para of section.paragraphs) {
    const p = renderParagraph(para);
    div.appendChild(p);
  }

  return div;
}

/**
 * Render a paragraph with its segments.
 */
function renderParagraph(para) {
  const p = document.createElement('p');
  p.className = 'para';

  for (const seg of para.segments) {
    const span = document.createElement('span');

    if (seg.type === 'vocab') {
      span.className = 'vocab';
      span.dataset.word = seg.word;
      span.dataset.root = seg.root;
      span.dataset.meaning = seg.contextMeaning;
      span.textContent = seg.word;
    } else if (seg.type === 'text') {
      span.className = 'text';
      if (seg.bold) {
        span.classList.add('bold');
      }
      span.textContent = seg.value;
    } else {
      span.className = 'text';
      span.textContent = seg.value || '';
    }

    p.appendChild(span);
  }

  return p;
}

/**
 * Render grammar notes block.
 */
function renderGrammarNotes(notes) {
  const div = document.createElement('div');
  div.className = 'grammar-notes';

  for (const note of notes) {
    const noteEl = document.createElement('div');
    noteEl.className = 'grammar-note';

    if (note.type === 'breakdown') {
      // Skip sentence breakdown notes (not meaningful in current form)
      continue;
    }

    // Grammar note or epilogue
    const header = document.createElement('div');
    header.className = 'grammar-note-header';
    header.innerHTML = `
      <span>📝 ${escapeHtml(note.label)}</span>
      <span class="toggle-icon">▼</span>
    `;

    const body = document.createElement('div');
    body.className = 'grammar-note-body';

    const content = document.createElement('p');
    content.className = 'grammar-text';
    content.innerHTML = renderBoldMarkers(note.content);
    body.appendChild(content);

    header.addEventListener('click', () => {
      noteEl.classList.toggle('collapsed');
    });

    noteEl.appendChild(header);
    noteEl.appendChild(body);

    div.appendChild(noteEl);
  }

  return div;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Convert **text** to <strong>text</strong> in a string (for grammar notes).
 */
function renderBoldMarkers(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
