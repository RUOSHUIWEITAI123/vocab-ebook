/**
 * 从 ECDICT 词典中提取常用词汇，生成精简 JSON 词典。
 * 用法: node scripts/filter-ecdict.js
 * 输入: public/data/ecdict.csv (用户手动下载)
 * 输出: public/data/extra-dict.json (~200KB)
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const INPUT = path.resolve(rootDir, 'public', 'data', 'ecdict.csv');
const OUTPUT = path.resolve(rootDir, 'public', 'data', 'extra-dict.json');

const MAX_WORDS = 10000; // 提取前1万个常用词
const TARGET_TAGS = ['cet4', 'cet6', 'gk', 'ielts', 'toefl', 'ky']; // 考研相关标签

async function main() {
  // 检查文件
  if (!fs.existsSync(INPUT)) {
    console.error('❌ 找不到 ecdict.csv，请先下载到 public/data/');
    console.error('   下载地址: https://github.com/skywind3000/ECDICT/raw/master/ecdict.csv');
    process.exit(1);
  }

  const fileSize = (fs.statSync(INPUT).size / 1024 / 1024).toFixed(1);
  console.log(`📖 Reading ECDICT: ${fileSize} MB (this will take ~1 minute)`);

  const dict = {};
  const candidates = []; // { word, translation, bnc, frq, tag }

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity
  });

  let header = null;
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 500000 === 0) console.log(`  ... ${(lineNum / 1000000).toFixed(1)}M lines`);

    // Parse CSV (simple: split by comma, handle quotes)
    const cols = parseCSVLine(line);

    if (!header) {
      header = cols;
      console.log('   Columns:', header.join(', '));
      continue;
    }

    const row = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cols[i] || '';
    }

    const word = row.word?.trim();
    const translation = row.translation?.trim();
    const bnc = parseInt(row.bnc) || 999999;
    const frq = parseInt(row.frq) || 999999;
    const tag = row.tag || '';

    if (!word || !translation) continue;
    if (word.length < 2) continue;

    // 优先收录：有考试标签的
    const hasTargetTag = TARGET_TAGS.some(t => tag.includes(t));
    // 或 BNC 排名靠前的
    const isCommonEnough = bnc <= 20000;

    if (hasTargetTag || isCommonEnough) {
      candidates.push({ word, translation, bnc, frq, hasTargetTag });
    }
  }

  console.log(`   Found ${candidates.length} candidates`);

  // 排序：考试标签优先，然后按 BNC 排名
  candidates.sort((a, b) => {
    if (a.hasTargetTag !== b.hasTargetTag) return a.hasTargetTag ? -1 : 1;
    return a.bnc - b.bnc;
  });

  // 取前 MAX_WORDS 个，去重
  const seen = new Set();
  for (const c of candidates) {
    const lower = c.word.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    dict[lower] = c.translation;
    if (Object.keys(dict).length >= MAX_WORDS) break;
  }

  console.log(`✅ Generated dictionary: ${Object.keys(dict).length} entries`);

  fs.writeFileSync(OUTPUT, JSON.stringify(dict, null, 2), 'utf-8');
  const outSize = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`📁 Written: ${OUTPUT} (${outSize} KB)`);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

main().catch(err => { console.error(err); process.exit(1); });
