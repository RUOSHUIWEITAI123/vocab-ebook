/**
 * 解析金榜四级词汇文件 → 结构化 JSON（类似 580 词格式）
 * 输出: public/data/cet4-content.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const SRC = path.resolve(rootDir, '..', '英语', '四级', '金榜-12月份四级和六级词汇【汇总版】.md');
const OUT = path.resolve(rootDir, 'public', 'data', 'cet4-content.json');

function main() {
  const text = fs.readFileSync(SRC, 'utf-8');
  const lines = text.split('\n');

  const parts = [];
  let currentPart = null;
  let currentSection = null;
  let inContext = false;
  let contextEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Part headers
    const partMatch = trimmed.match(/^## Part (\w+)\s+(.+)/);
    if (partMatch) {
      if (currentPart) parts.push(currentPart);
      currentPart = {
        id: `cet4-part-${parts.length + 1}`,
        number: parts.length + 1,
        title: `Part ${partMatch[1]} — ${partMatch[2]}`,
        partLabel: `Part ${partMatch[1]}`,
        partTitle: partMatch[2],
        sections: []
      };
      currentSection = null;
      inContext = partMatch[2].includes('语境');
      continue;
    }

    if (!currentPart) continue;

    // Section headers
    const secMatch = trimmed.match(/^###\s+(.+)/);
    if (secMatch) {
      if (inContext) {
        // Context sentence entry
        if (contextEntry && contextEntry.english) {
          currentPart.sections.push({
            type: 'context',
            english: contextEntry.english,
            chinese: contextEntry.chinese,
            words: contextEntry.words
          });
        }
        contextEntry = {
          title: secMatch[1],
          english: '',
          chinese: '',
          words: []
        };
      } else {
        // Vocab section
        currentSection = {
          type: 'vocab-list',
          title: secMatch[1],
          words: [],
          notes: []
        };
        currentPart.sections.push(currentSection);
      }
      continue;
    }

    // Context: collect English sentence
    if (inContext && contextEntry && !trimmed.startsWith('【') && !trimmed.startsWith('##') && !trimmed.startsWith('###') && trimmed) {
      if (!trimmed.startsWith('-') && !trimmed.match(/^\d+/)) {
        contextEntry.english += ' ' + trimmed;
      }
    }

    // Context: Chinese translation
    if (inContext && contextEntry && trimmed.startsWith('【参考译文】')) {
      contextEntry.chinese = trimmed.replace('【参考译文】', '').trim();
    }

    // Context: key vocabulary
    if (inContext && contextEntry && trimmed.match(/^\*\*(\d+)\.\s+(.+)\*\*/)) {
      const m = trimmed.match(/^\*\*(\d+)\.\s+(.+)\*\*\s+(.+)$/);
      if (m) {
        contextEntry.words.push({ word: m[2].trim(), meaning: m[3].trim() });
      }
    }

    // Vocab entries (number. word pos. meaning)
    if (!inContext && currentSection && currentSection.type === 'vocab-list') {
      const vm = trimmed.match(/^(\d+)\.\s+(\w+)\s+(\w+)\.?\s+(.+)$/);
      if (vm) {
        currentSection.words.push({
          number: parseInt(vm[1]),
          word: vm[2],
          pos: vm[3],
          meaning: vm[4]
        });
      } else {
        // Notes / derivatives
        if (trimmed && !trimmed.startsWith('#')) {
          currentSection.notes.push(trimmed);
        }
      }
    }
  }

  // Save last part and context
  if (contextEntry && contextEntry.english) {
    // Add to the last part
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      lastPart.sections.push({
        type: 'context',
        english: contextEntry.english,
        chinese: contextEntry.chinese,
        words: contextEntry.words
      });
    }
  }
  if (currentPart) parts.push(currentPart);

  // Rebuild: remove duplicate parts (the push at end creates duplicate)
  // Actually just fix the list
  const cleanParts = [];
  const seen = new Set();
  for (const p of parts) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      cleanParts.push(p);
    }
  }

  const output = {
    meta: {
      title: '四级词汇讲义 — 金榜12月版',
      totalParts: cleanParts.length,
      generatedAt: new Date().toISOString()
    },
    parts: cleanParts
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2), 'utf-8');

  // Stats
  let totalWords = 0;
  let contextCount = 0;
  for (const p of cleanParts) {
    for (const s of p.sections) {
      if (s.type === 'vocab-list') totalWords += s.words.length;
      if (s.type === 'context') contextCount++;
    }
  }
  console.log(`Parts: ${cleanParts.length}, Vocab words: ${totalWords}, Context sentences: ${contextCount}`);
  console.log(`✅ Written: ${OUT}`);
}

main();
