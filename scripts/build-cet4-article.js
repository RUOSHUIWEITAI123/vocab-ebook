/**
 * Generate complete CET-4 article covering ALL words from the original MD file.
 * Reads the original MD, extracts word:meaning pairs, generates a narrative article.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const SRC = path.resolve(rootDir, '..', '英语', '四级', '金榜-12月份四级和六级词汇【汇总版】.md');
const OUT = path.resolve(rootDir, 'public', 'data', 'cet4-article.md');

// Read original MD
const text = fs.readFileSync(SRC, 'utf-8');
const lines = text.split('\n');

// Extract ALL word:meaning pairs with context
const allWords = [];
let currentSection = '';

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith('#')) {
    if (t.startsWith('###')) currentSection = t.replace(/^###\s*/, '');
    continue;
  }

  // Numbered headword: N. word POS. meaning
  let m = t.match(/^(\d+)\.\s+(\w+)\s+(\w+\.?)\s*(.+)$/);
  if (m) {
    const meaning = m[4].replace(/[;；].*/,'').substring(0,80);
    allWords.push({ word: m[2], meaning, pos: m[3], section: currentSection });
    continue;
  }

  // Derivative/synonym: word POS. meaning
  m = t.match(/^([a-z]{2,})\s+(\w+\.?)\s+(.+)$/);
  if (m && !t.startsWith('=') && !t.startsWith('-') && !t.startsWith('"') && m[1].length >= 3) {
    const meaning = m[3].replace(/[;；].*/,'').substring(0,80);
    if (!allWords.some(w => w.word === m[1])) {
      allWords.push({ word: m[1], meaning, pos: m[2], section: currentSection });
    }
  }
}

// Remove duplicates by word
const seen = new Set();
const unique = allWords.filter(w => {
  const lower = w.word.toLowerCase();
  if (seen.has(lower) || lower.length < 2) return false;
  seen.add(lower);
  return true;
});

console.log(`Total unique words: ${unique.length}`);

// Generate article: split into 25 parts, ~20 words each
const WORDS_PER_PART = 20;
const parts = [];

for (let i = 0; i < unique.length; i += WORDS_PER_PART) {
  const chunk = unique.slice(i, i + WORDS_PER_PART);
  if (chunk.length === 0) break;

  const partNum = parts.length + 1;
  const titles = [
    'A New Beginning', 'The Classroom', 'Campus Life', 'The Library',
    'Daily Routines', 'Friendship', 'The Challenge', 'Success and Failure',
    'City and Country', 'Work and Career', 'The Market', 'Technology',
    'Society and Law', 'Health and Body', 'The Mind', 'Emotions',
    'Travel and Journey', 'Nature and Science', 'Art and Culture',
    'The Debate', 'Reflection', 'The Future', 'Knowledge', 'Dreams', 'Growth'
  ];
  const title = titles[partNum - 1] || `Chapter ${partNum}`;

  // Build English paragraph
  const words = chunk.map(w => `**${w.word}**（${w.meaning.substring(0,40)}）`);
  const en = `In this chapter of his journey, Zhang Wei encountered many new concepts and ideas. He reflected on terms such as ${words.join(', ')} — each carrying its own weight and significance in his understanding of the world. These were not just vocabulary items to memorize, but windows into new ways of thinking and expressing ideas.`;

  // Build Chinese paragraph
  const cnWords = chunk.map(w => `**${w.word}**「${w.meaning.substring(0,40)}」`);
  const cn = `在他旅程的这一章中，张伟遇到了许多新的概念和想法。他思考了诸如 ${cnWords.join('、')} 等词汇——每个词都对他理解世界有着独特的分量和意义。这些不仅仅是需要记住的单词，而是通向新思维方式和表达方式的窗口。`;

  parts.push({ title: `Part ${partNum} — ${title}`, en, cn });
}

// Build markdown
let md = `# The Complete Journey — CET-4 Full Vocabulary Story

> This article covers ALL ${unique.length} vocabulary words from the CET-4 Gold List.
> Left-click any word for translation, right-click any paragraph for full sentence translation.

---

`;

for (const part of parts) {
  md += `## ${part.title}\n\n`;
  md += part.en + '\n\n';
  md += part.cn + '\n\n';
  md += '---\n\n';
}

md += `> **后记**：本文覆盖了 CET-4 金榜全部 ${unique.length} 个词汇。点击任意单词查看翻译，右键段落查看整句对照。\n`;

fs.writeFileSync(OUT, md, 'utf-8');
console.log(`Generated ${parts.length} parts, ${unique.length} words`);
console.log(`Written: ${OUT} (${(fs.statSync(OUT).size/1024).toFixed(1)}KB)`);
