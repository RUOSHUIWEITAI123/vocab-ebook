/**
 * Build complete CET-4 article: takes existing 10 parts + generates remaining 8 parts
 * to cover all 352 vocabulary words.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const VOCAB = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'public', 'data', 'cet4-vocab.json'), 'utf-8'));
const EXISTING = fs.readFileSync(path.resolve(rootDir, 'public', 'data', 'cet4-article-backup.md'), 'utf-8');

// Find words already used
const used = new Set([...EXISTING.matchAll(/\*\*(.+?)\*\*（/g)].map(m => m[1].toLowerCase()));
const missing = Object.entries(VOCAB).filter(([w]) => !used.has(w));

// Generate sentences for missing words, organized in groups
function makeSentence(words) {
  return words.map(([w, m]) => {
    const meaning = m.replace(/；.*/, '').substring(0, 40);
    return `**${w}**（${meaning}）`;
  }).join(', ');
}

// Build parts - each ~40 words
const parts = [];
for (let i = 0; i < missing.length; i += 40) {
  const chunk = missing.slice(i, i + 40);
  const mid = Math.floor(chunk.length / 2);
  const s1 = makeSentence(chunk.slice(0, mid));
  const s2 = makeSentence(chunk.slice(mid));

  const en = `Zhang Wei reviewed his vocabulary journal. The first group included: ${s1}. Then he continued with more terms: ${s2}. Each word represented a concept he had encountered during his university journey — some from lectures, some from conversations, some from his own reading and reflection.`;

  const cn = `张伟复习着他的词汇日记。第一组包括：${s1}。然后他继续更多的术语：${s2}。每个词代表他在大学旅程中遇到的一个概念——有些来自课堂，有些来自谈话，有些来自他自己的阅读和反思。`;

  parts.push({ en, cn });
}

// Assemble final article
let output = EXISTING;
const insertPoint = output.lastIndexOf('---');
const suffix = output.substring(insertPoint);

for (let i = 0; i < parts.length; i++) {
  const partNum = 10 + i + 1;
  output += `\n## Part ${partNum} — Vocabulary Review ${i + 1}\n\n`;
  output += parts[i].en + '\n\n';
  output += parts[i].cn + '\n\n';
  output += '---\n\n';
}

output += suffix;

// Verify coverage
const final = output;
const finalUsed = new Set([...final.matchAll(/\*\*(.+?)\*\*（/g)].map(m => m[1].toLowerCase()));
const finalMissing = Object.keys(VOCAB).filter(w => !finalUsed.has(w));

console.log(`Parts added: ${parts.length}`);
console.log(`Words covered: ${finalUsed.size} / ${Object.keys(VOCAB).length}`);
if (finalMissing.length > 0) {
  console.log(`Still missing (${finalMissing.length}): ${finalMissing.join(', ')}`);
}

fs.writeFileSync(path.resolve(rootDir, 'public', 'data', 'cet4-article.md'), output, 'utf-8');
console.log('Written: cet4-article.md');
