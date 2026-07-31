/**
 * 将 ECDICT 完整词典转换为按字母分割的 JSON 文件。
 * 用法: node scripts/convert-ecdict.js
 * 输入: public/data/ecdict.csv (用户手动下载)
 * 输出: public/data/dict/{a..z}.json (26个文件)
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const INPUT = path.resolve(rootDir, 'public', 'data', 'ecdict.csv');
const OUT_DIR = path.resolve(rootDir, 'public', 'data', 'dict');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('❌ 找不到 ecdict.csv');
    console.error('   下载地址: https://github.com/skywind3000/ECDICT/raw/master/ecdict.csv');
    console.error('   请放到 public/data/ 目录下');
    process.exit(1);
  }

  const fileSize = (fs.statSync(INPUT).size / 1024 / 1024).toFixed(1);
  console.log(`📖 Reading ECDICT: ${fileSize} MB`);
  console.log('   This will take 2-3 minutes for the full file...\n');

  // 26个字母 + 1个特殊字符桶
  const buckets = {};
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  for (const l of LETTERS) buckets[l] = {};
  buckets['_'] = {}; // 数字/特殊字符开头的词

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity
  });

  let header = null;
  let lineNum = 0;
  let imported = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 200000 === 0) {
      console.log(`  ... ${(lineNum / 1000000).toFixed(1)}M lines, ${imported} words`);
    }

    const cols = parseCSVLine(line);
    if (!header) { header = cols; continue; }

    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] || '';

    const word = row.word?.trim().toLowerCase();
    const translation = row.translation?.trim();
    if (!word || !translation || word.length < 2) continue;

    const firstChar = word[0];
    const bucketKey = LETTERS.includes(firstChar) ? firstChar : '_';

    // 只保留第一个释义（去重时最新的覆盖旧的，取第一个遇到的）
    if (!buckets[bucketKey][word]) {
      buckets[bucketKey][word] = translation;
      imported++;
    }
  }

  console.log(`\n✅ Imported ${imported} unique words into ${Object.keys(buckets).length} buckets`);

  // 写入文件
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 生成索引文件
  const index = {};
  let totalSize = 0;

  for (const key of Object.keys(buckets).sort()) {
    const data = buckets[key];
    const count = Object.keys(data).length;
    if (count === 0) continue;

    const fname = `dict-${key}.json`;
    const fpath = path.join(OUT_DIR, fname);
    const json = JSON.stringify(data);
    fs.writeFileSync(fpath, json, 'utf-8');
    const size = (json.length / 1024).toFixed(1);
    totalSize += json.length;

    index[key] = { file: fname, count, size: size + 'KB' };
    console.log(`   ${fname}: ${count} words, ${size} KB`);
  }

  // 写索引
  const indexPath = path.join(OUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n📁 Total: ${(totalSize / 1024 / 1024).toFixed(1)} MB in ${Object.keys(index).length} files`);
  console.log(`📁 Index: ${indexPath}`);
  console.log('✅ Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
