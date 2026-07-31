/**
 * Renderer — converts a single part into DOM, links translations.
 */

/**
 * Render a single part into the container.
 */
export function renderPart(part, container, dataset) {
  const el = document.createElement('div');
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
    if (sectionEl) el.appendChild(sectionEl);
  }

  container.appendChild(el);

  // Link English paragraphs to Chinese translations (kaoyan only)
  if (part.sections.some(s => s.type === 'english')) {
    linkTranslations(el);
  }
}

function linkTranslations(partEl) {
  const englishParas = [];
  const chineseParas = [];

  const sections = partEl.querySelectorAll(':scope > .section');
  for (const section of sections) {
    const type = section.dataset.sectionType;
    const paras = section.querySelectorAll('.para');
    for (const para of paras) {
      if (type === 'english') englishParas.push(para);
      else if (type === 'chinese') chineseParas.push(para);
    }
  }

  const count = Math.min(englishParas.length, chineseParas.length);
  for (let i = 0; i < count; i++) {
    const html = formatChineseTranslation(chineseParas[i]);
    if (html) {
      englishParas[i].dataset.translationHtml = html;
      englishParas[i].classList.add('has-translation');
    }
  }
}

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

function renderSection(section) {
  if (section.type === 'grammar-notes') {
    return renderGrammarNotes(section.notes);
  }

  // CET-4 vocab list section
  if (section.type === 'vocab-list') {
    const div = document.createElement('div');
    div.className = 'section section-vocab-list';
    const title = document.createElement('h3');
    title.className = 'vocab-list-title';
    title.textContent = section.title || '';
    div.appendChild(title);
    for (const w of section.words) {
      const item = document.createElement('div');
      item.className = 'vocab-list-item';
      item.innerHTML = `<span class="vocab" data-word="${w.word}" data-root="${w.word.toLowerCase()}" data-meaning="${w.meaning}">${w.word}</span> <span class="text">${w.pos}. ${w.meaning}</span>`;
      div.appendChild(item);
    }
    return div;
  }

  // CET-4 context section
  if (section.type === 'context') {
    const div = document.createElement('div');
    div.className = 'section section-context';
    const enP = document.createElement('p');
    enP.className = 'para has-translation';
    enP.innerHTML = section.english;
    // Mark vocab words in context
    for (const w of section.words) {
      if (w.word) {
        enP.innerHTML = enP.innerHTML.replace(
          new RegExp(`\\b(${w.word})\\b`, 'gi'),
          `<span class="vocab" data-word="$1" data-root="${w.word.toLowerCase()}" data-meaning="${w.meaning}">$1</span>`
        );
      }
    }
    enP.dataset.translationHtml = escapeHtml(section.chinese || '');
    div.appendChild(enP);
    if (section.chinese) {
      const cnP = document.createElement('p');
      cnP.className = 'para section-chinese';
      cnP.textContent = section.chinese;
      cnP.style.display = 'none';
      div.appendChild(cnP);
    }
    return div;
  }

  // Standard english/chinese sections (kaoyan)
  const div = document.createElement('div');
  div.className = `section section-${section.type}`;
  div.dataset.sectionType = section.type;

  for (const para of section.paragraphs) {
    const p = renderParagraph(para);
    div.appendChild(p);
  }

  return div;
}

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
      if (seg.bold) span.classList.add('bold');
      span.textContent = seg.value;
    } else {
      span.className = 'text';
      span.textContent = seg.value || '';
    }

    p.appendChild(span);
  }

  return p;
}

function renderGrammarNotes(notes) {
  const div = document.createElement('div');
  div.className = 'grammar-notes';

  for (const note of notes) {
    const noteEl = document.createElement('div');
    noteEl.className = 'grammar-note';

    if (note.type === 'breakdown') {
      continue; // Skip breakdown notes
    }

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

    header.addEventListener('click', () => noteEl.classList.toggle('collapsed'));
    noteEl.appendChild(header);
    noteEl.appendChild(body);
    div.appendChild(noteEl);
  }

  return div;
}

function renderBoldMarkers(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
