/**
 * 从金榜四级六级词汇文件中提取词表
 * 输出:
 *   public/data/cet4-vocab.json — 四级词汇索引
 *   public/data/cet6-vocab.json — 六级词汇索引
 *   public/data/cet46-context.json — 语境句子
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const SRC = path.resolve(rootDir, '..', '英语', '四级', '金榜-12月份四级和六级词汇【汇总版】.md');
const OUT_CET4 = path.resolve(rootDir, 'public', 'data', 'cet4-vocab.json');
const OUT_CET6 = path.resolve(rootDir, 'public', 'data', 'cet6-vocab.json');
const OUT_CTX = path.resolve(rootDir, 'public', 'data', 'cet46-context.json');

// 四级 vs 六级标记词
const CET6_MARKERS = ['六级', 'cet6', 'CET6', 'CET-6'];
const CET4_MARKERS = ['四级', 'cet4', 'CET4', 'CET-4'];

function main() {
  const text = fs.readFileSync(SRC, 'utf-8');
  const lines = text.split('\n');

  const cet4Words = {};
  const cet6Words = {};
  const contextSentences = [];

  let currentSection = '';
  let currentLevel = 'cet4'; // default

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Track headers
    if (line.startsWith('# 四级')) currentLevel = 'cet4';
    if (line.startsWith('# 六级')) currentLevel = 'cet6';
    if (line.startsWith('## Part Three')) currentSection = 'context';
    if (line.startsWith('## Part')) currentSection = line;

    // Numbered headword: 1. word pos. meaning
    const numMatch = line.match(/^(\d+)\.\s+(\w+)\s+(\w+)\.?\s+(.+)$/);
    if (numMatch) {
      const word = numMatch[2].toLowerCase().trim();
      const pos = numMatch[3].trim();
      const meaning = numMatch[4].trim();
      if (word.length >= 2) {
        if (currentLevel === 'cet6') {
          if (!cet6Words[word]) cet6Words[word] = meaning;
        } else {
          if (!cet4Words[word]) cet4Words[word] = meaning;
        }
      }
      continue;
    }

    // Derivative word: word pos. meaning (starts with lowercase letter, no number)
    const derivMatch = line.match(/^([a-z]\w+)\s+(\w+)\.?\s+(.+)$/);
    if (derivMatch && !line.match(/^[=]/) && !line.match(/^[""*]/)) {
      const word = derivMatch[1].toLowerCase().trim();
      const meaning = derivMatch[3].trim();
      if (word.length >= 2 && meaning.length > 1 && !meaning.startsWith('.')) {
        if (currentLevel === 'cet6') {
          if (!cet6Words[word]) cet6Words[word] = meaning;
        } else {
          if (!cet4Words[word]) cet4Words[word] = meaning;
        }
      }
    }

    // Context sentences (Part Three)
    if (currentSection === 'context' && line.match(/^###\s+\d+\./)) {
      const title = line.replace(/^###\s+/, '').trim();
      const engLines = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith('###') && !lines[j].trim().startsWith('##')) {
        const l = lines[j].trim();
        if (l && !l.startsWith('>')) engLines.push(l);
        j++;
      }
      contextSentences.push({
        title: title.substring(0, 80),
        english: engLines.join(' ').substring(0, 500),
        chinese: '', // will be filled later
      });
    }
  }

  console.log(`CET-4 words: ${Object.keys(cet4Words).length}`);
  console.log(`CET-6 words: ${Object.keys(cet6Words).length}`);
  console.log(`Context sentences: ${contextSentences.length}`);

  fs.writeFileSync(OUT_CET4, JSON.stringify(cet4Words, null, 2), 'utf-8');
  fs.writeFileSync(OUT_CET6, JSON.stringify(cet6Words, null, 2), 'utf-8');
  fs.writeFileSync(OUT_CTX, JSON.stringify(contextSentences, null, 2), 'utf-8');
  console.log('✅ Written vocab files');
}

main();
