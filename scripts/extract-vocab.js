/**
 * 从 考研词汇闪过_580词.md 中提取580个单词的完整释义，生成词汇索引JSON。
 * 输出: public/data/vocab-index.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const SOURCE = path.resolve(rootDir, 'public', 'data', '考研词汇闪过_580词.md');
const OUTPUT = path.resolve(rootDir, 'public', 'data', 'vocab-index.json');

function extractVocabIndex(markdown) {
  const vocab = {};
  const lines = markdown.split('\n');

  let inTable = false;

  for (const line of lines) {
    // Detect table rows: | # | **word** | meaning | ... |
    const tableMatch = line.match(/^\|\s*\d+\s*\|\s*\*\*(.+?)\*\*\s*\|/);
    if (tableMatch) {
      inTable = true;
      const word = tableMatch[1].trim().toLowerCase();
      // Extract meaning from the 3rd column
      const cols = line.split('|').map(c => c.trim());
      if (cols.length >= 4) {
        const meaningRaw = cols[3] || '';
        // Split meanings by semicolons (Chinese or English)
        const meanings = meaningRaw
          .split(/[；;]/)
          .map(m => m.trim())
          .filter(Boolean);

        vocab[word] = meanings;
      }
    }
  }

  return vocab;
}

function main() {
  console.log('📖 Reading vocabulary source...');
  const md = fs.readFileSync(SOURCE, 'utf-8');
  const index = extractVocabIndex(md);

  console.log(`✅ Extracted ${Object.keys(index).length} vocabulary entries`);

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`📁 Written to ${OUTPUT}`);
}

main();
