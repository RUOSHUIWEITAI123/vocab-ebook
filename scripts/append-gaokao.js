/**
 * Read chapters from gaokao-chapters.json and append to gaokao-article.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const article = path.resolve(rootDir, 'public', 'data', 'gaokao-article.md');
const vocab = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'public', 'data', 'gaokao-vocab.json'), 'utf-8'));

const chapters = JSON.parse(fs.readFileSync(process.argv[2] || path.resolve(rootDir, 'public', 'data', 'gaokao-chapters.json'), 'utf-8'));

let md = fs.readFileSync(article, 'utf-8');
md = md.replace('> 未完待续...\n', '');

const nextNum = (md.match(/^## Part (\d+)/gm) || []).length + 1;
let n = nextNum;

for (const ch of chapters) {
  md += `## Part ${n} — ${ch.title}\n\n`;
  md += ch.en + '\n\n';
  md += ch.cn + '\n\n---\n\n';
  n++;
}

md += '\n> 未完待续...\n';
fs.writeFileSync(article, md, 'utf-8');

const used = new Set([...md.matchAll(/\*\*(.+?)\*\*[（(]/g)].map(m => m[1].toLowerCase()));
const rem = Object.keys(vocab).filter(w => !used.has(w));
console.log(`Added ${chapters.length} chapters (${nextNum}-${n-1})`);
console.log(`Covered: ${used.size}/${Object.keys(vocab).length} | Remaining: ${rem.length} | Est. chapters: ${Math.ceil(rem.length/20)}`);
