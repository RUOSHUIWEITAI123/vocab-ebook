/**
 * 解析 580词涵括文章.md → 结构化的 content.json。
 * 输出: public/data/content.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const SOURCE = path.resolve(rootDir, '..', '英语', '580词涵括文章.md');
const VOCAB_INDEX_PATH = path.resolve(rootDir, 'public', 'data', 'vocab-index.json');
const OUTPUT = path.resolve(rootDir, 'public', 'data', 'content.json');

// ── Helpers ──────────────────────────────────────────────

/** Check if a character is CJK (Chinese/Japanese/Korean) */
function isCJK(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x4E00 && cp <= 0x9FFF) ||
         (cp >= 0x3400 && cp <= 0x4DBF) ||
         (cp >= 0xF900 && cp <= 0xFAFF) ||
         (cp >= 0x3000 && cp <= 0x303F); // CJK punctuation
}

/** Determine if a line is predominantly Chinese */
function isChineseLine(line) {
  const trimmed = line.replace(/\s/g, '');
  if (trimmed.length === 0) return false;
  let cjk = 0;
  for (const ch of trimmed) {
    if (isCJK(ch)) cjk++;
  }
  return cjk / trimmed.length > 0.4;
}

/** Parse a paragraph line into segments */
function parseSegments(text, bracketType, vocabIndex) {
  const segments = [];
  // Match: **word** optionally followed by （meaning） or 「meaning」
  // Group 1: word, Group 2: full annotation including brackets (optional)
  const regex = /\*\*(.+?)\*\*(([（「].+?[）」])?)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        segments.push({ type: 'text', value: before });
      }
    }

    const rawWord = match[1].trim();
    const annotation = match[2] || '';  // e.g. "（穿梭航班）" or "" if no annotation

    // Extract meaning from annotation (strip brackets)
    let meaning = '';
    if (annotation) {
      // Remove 「」 or （）
      meaning = annotation.replace(/^[（「]/, '').replace(/[）」]$/, '').trim();
    }

    const wordLower = rawWord.toLowerCase();
    const root = findRootWord(wordLower, vocabIndex);

    if (meaning && (root || vocabIndex[wordLower])) {
      // Annotated vocab word → green clickable
      segments.push({
        type: 'vocab',
        word: rawWord,
        root: root || wordLower,
        contextMeaning: meaning
      });
    } else if (root || vocabIndex[wordLower]) {
      // No annotation but word is in vocab list → green clickable (no context meaning)
      segments.push({
        type: 'vocab',
        word: rawWord,
        root: root || wordLower,
        contextMeaning: meaning || ''
      });
    } else if (meaning) {
      // Annotated but not in vocab list → bold + annotation as text
      segments.push({
        type: 'text',
        value: rawWord,
        bold: true
      });
      segments.push({
        type: 'text',
        value: annotation
      });
    } else {
      // **word** without annotation, not in vocab → just bold text
      segments.push({
        type: 'text',
        value: rawWord,
        bold: true
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    const after = text.slice(lastIndex);
    if (after) {
      segments.push({ type: 'text', value: after });
    }
  }

  // If no matches, return the whole text as one segment
  if (segments.length === 0) {
    segments.push({ type: 'text', value: text });
  }

  return segments;
}

/** Find the root word for an inflected form */
function findRootWord(word, vocabIndex) {
  if (vocabIndex[word]) return word;

  // Common inflections → root
  const rules = [
    // -ing forms: steering → steer, stretching → stretch
    { suffix: 'ing', replace: ['', 'e'] },
    // -ed forms: twisted → twist, landed → land
    { suffix: 'ed', replace: ['', 'e', 'd'] },
    // -s/-es plurals: wheels → wheel, stretches → stretch
    { suffix: 'es', replace: ['', 'e'] },
    { suffix: 's', replace: [''] },
    // -ied: carried → carry
    { suffix: 'ied', replace: ['y'] },
  ];

  for (const rule of rules) {
    if (word.endsWith(rule.suffix)) {
      const stem = word.slice(0, -rule.suffix.length);
      for (const repl of rule.replace) {
        const candidate = stem + repl;
        if (vocabIndex[candidate]) return candidate;
      }
    }
  }

  return null;
}

/** Parse grammar note content */
function parseGrammarNote(lines, vocabIndex) {
  const notes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect labeled grammar note headers: **xxx：**
    const headerMatch = line.match(/^\*\*(.+?)[：:]\*\*/);
    if (headerMatch) {
      const label = headerMatch[1].trim();
      const rest = line.slice(headerMatch[0].length).trim();

      // Check if this is a sentence breakdown (小句拆解 / 整句拆解)
      if (label.includes('拆解')) {
        const breakdownLines = [];
        if (rest) breakdownLines.push(rest);
        i++;
        // Collect indented lines (the list items)
        while (i < lines.length && lines[i].match(/^>\s*-/)) {
          breakdownLines.push(lines[i].replace(/^>\s*/, ''));
          i++;
        }
        notes.push({
          type: 'breakdown',
          label,
          intro: rest || null,
          lines: breakdownLines
        });
        continue;
      }

      // Check if this is the "后记" (epilogue)
      if (label.includes('后记')) {
        notes.push({
          type: 'note',
          label: '后记',
          content: rest
        });
        i++;
        continue;
      }

      // Generic grammar note
      const noteLines = [];
      if (rest) noteLines.push(rest);
      i++;
      while (i < lines.length && lines[i].match(/^>\s*(?!\*\*)/)) {
        noteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }
      notes.push({
        type: 'grammar',
        label,
        content: noteLines.join('\n')
      });
      continue;
    }

    // Plain blockquote line (continuation of previous note or orphan)
    i++;
  }

  return notes;
}

// ── Main Parser ──────────────────────────────────────────

function parseContent(markdown, vocabIndex) {
  const lines = markdown.split('\n');
  const parts = [];
  let currentPart = null;
  let currentSection = null; // { type, content[] }
  let blockquoteBuffer = [];
  let inBlockquote = false;

  function flushBlockquote() {
    if (blockquoteBuffer.length === 0) return;
    const notes = parseGrammarNote(blockquoteBuffer, vocabIndex);
    if (notes.length > 0 && currentPart) {
      // Add as grammar section
      currentPart.sections.push({
        type: 'grammar-notes',
        notes
      });
    }
    blockquoteBuffer = [];
  }

  function flushSection() {
    if (!currentSection || !currentPart) return;
    if (currentSection.paragraphs && currentSection.paragraphs.length > 0) {
      currentPart.sections.push(currentSection);
    }
    currentSection = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      if (!inBlockquote) {
        flushSection();
      }
      continue;
    }

    // Skip article H1 title and intro blockquotes (before first Part)
    if (trimmed.match(/^#\s/) && !trimmed.match(/^##\s/)) {
      // Single-hash title — skip it (intro material)
      continue;
    }

    // Part header: ## Part N — Title
    const partMatch = trimmed.match(/^##\s+(Part\s+\d+)\s*[—\-—]\s*(.+)/);
    if (partMatch) {
      flushBlockquote();
      flushSection();
      currentPart = {
        id: partMatch[1].toLowerCase().replace(/\s+/g, '-'),
        number: parseInt(partMatch[1].match(/\d+/)?.[0]) || 0,
        title: `${partMatch[1]} — ${partMatch[2].trim()}`,
        partLabel: partMatch[1],
        partTitle: partMatch[2].trim(),
        sections: []
      };
      parts.push(currentPart);
      continue;
    }

    // Epilogue header: ## Epilogue — Title
    const epilogueMatch = trimmed.match(/^##\s+(Epilogue|后记)\s*[—\-—]\s*(.+)/i);
    if (epilogueMatch) {
      flushBlockquote();
      flushSection();
      currentPart = {
        id: 'epilogue',
        number: parts.length + 1,
        title: `Epilogue — ${epilogueMatch[2].trim()}`,
        partLabel: 'Epilogue',
        partTitle: epilogueMatch[2].trim(),
        sections: []
      };
      parts.push(currentPart);
      continue;
    }

    // Horizontal rule separator
    if (trimmed.match(/^---+$/)) {
      flushBlockquote();
      flushSection();
      continue;
    }

    // Blockquote (grammar notes)
    if (line.startsWith('>')) {
      if (!inBlockquote) {
        flushSection();
        inBlockquote = true;
      }
      // Clean the line: remove leading "> "
      const cleaned = line.replace(/^>\s?/, '');
      blockquoteBuffer.push(cleaned);
      continue;
    } else if (inBlockquote) {
      // End of blockquote
      flushBlockquote();
      inBlockquote = false;
    }

    // Regular paragraph text
    if (trimmed) {
      const isChinese = isChineseLine(trimmed);
      const sectionType = isChinese ? 'chinese' : 'english';
      const bracketType = isChinese ? 'cn' : 'en';

      // Decide whether to start a new section or append
      if (!currentSection || currentSection.type !== sectionType) {
        flushSection();
        currentSection = {
          type: sectionType,
          paragraphs: []
        };
      }

      const segments = parseSegments(trimmed, bracketType, vocabIndex);
      currentSection.paragraphs.push({ segments });
    }
  }

  // Flush remaining
  flushBlockquote();
  flushSection();

  return parts;
}

// ── Main ─────────────────────────────────────────────────

function main() {
  console.log('📖 Loading vocabulary index...');
  const vocabIndex = JSON.parse(fs.readFileSync(VOCAB_INDEX_PATH, 'utf-8'));

  console.log('📖 Reading article markdown...');
  const md = fs.readFileSync(SOURCE, 'utf-8');

  console.log('🔧 Parsing content...');
  const parts = parseContent(md, vocabIndex);

  // Collect stats
  const vocabWords = new Set();
  for (const part of parts) {
    for (const section of part.sections) {
      if (section.type === 'english' || section.type === 'chinese') {
        for (const para of section.paragraphs) {
          for (const seg of para.segments) {
            if (seg.type === 'vocab') {
              vocabWords.add(seg.root);
            }
          }
        }
      }
    }
  }

  const output = {
    meta: {
      title: 'Shuttling Through Time and Space — A Story of 580 Exam Words',
      totalParts: parts.length,
      uniqueVocabWords: vocabWords.size,
      generatedAt: new Date().toISOString()
    },
    parts
  };

  console.log(`✅ Parsed ${parts.length} parts with ${vocabWords.size} unique vocabulary words`);

  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`📁 Written to ${OUTPUT}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
}

main();
