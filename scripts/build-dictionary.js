/**
 * 构建离线词典：
 * 1. 从 vocab-index.json 提取 580 词的释义
 * 2. 扫描文章所有唯一单词
 * 3. 对不在580词表中的单词，批量调用 MyMemory API 翻译
 * 4. 合并输出 extra-dict.json
 *
 * 用法: node scripts/build-dictionary.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const CONTENT_PATH = path.resolve(rootDir, 'public', 'data', 'content.json');
const VOCAB_INDEX_PATH = path.resolve(rootDir, 'public', 'data', 'vocab-index.json');
const OUTPUT_PATH = path.resolve(rootDir, 'public', 'data', 'extra-dict.json');

// 提取单词的简单形式
function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z-]/g, '').trim();
}

// 从文章中提取所有单词（按频率排序）
function extractWordsByFreq(contentJson) {
  const freq = new Map();
  for (const part of contentJson.parts) {
    for (const section of part.sections) {
      if (section.type === 'english' || section.type === 'chinese') {
        for (const para of section.paragraphs) {
          for (const seg of para.segments) {
            if (seg.type === 'text') {
              const matches = seg.value.match(/[a-zA-Z]{2,}/g);
              if (matches) {
                for (const m of matches) {
                  const n = normalizeWord(m);
                  if (n.length >= 2) freq.set(n, (freq.get(n) || 0) + 1);
                }
              }
            }
            if (seg.type === 'vocab') {
              const n = normalizeWord(seg.root || seg.word);
              freq.set(n, (freq.get(n) || 0) + 1);
            }
          }
        }
      }
    }
  }
  // 按频率降序排列
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

// 翻译单个单词（带重试）
async function translateOne(word, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const query = `The word "${word}" means`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|zh`;
      const resp = await fetch(url);
      if (resp.status === 429 || resp.status === 403) {
        // Rate limited — wait longer
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const data = await resp.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const t = data.responseData.translatedText.trim();
        const idx = t.indexOf('一词的意思是');
        if (idx > 0) {
          let r = t.substring(0, idx).trim();
          if (r.length > 1) r = r.substring(1, r.length - 1).trim();
          if (r && r !== word) return r;
        }
      }
      return null;
    } catch (e) {
      if (attempt < retries) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return null;
}

// 逐个翻译（避免限流）
async function translateBatch(words) {
  const results = {};
  const total = words.length;
  let success = 0;

  for (let i = 0; i < words.length; i++) {
    const meaning = await translateOne(words[i]);
    if (meaning) {
      results[words[i]] = meaning;
      success++;
    }
    if ((i + 1) % 50 === 0) {
      console.log(`  ... ${i + 1}/${total} (${success} ok)`);
    }
    // 每个词间隔1.5秒，避免限流
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`  Done: ${success}/${total} translated`);
  return results;
}

// 主函数
async function main() {
  console.log('📖 Loading content...');
  const contentJson = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8'));
  const vocabIndex = JSON.parse(fs.readFileSync(VOCAB_INDEX_PATH, 'utf-8'));

  // 1. 提取所有单词（按频率排序）
  console.log('🔍 Extracting words by frequency...');
  const allWords = extractWordsByFreq(contentJson);
  console.log(`   Total unique words: ${allWords.length}`);

  // 2. 分离已覆盖/未覆盖，只翻译高频词
  const covered = new Set(Object.keys(vocabIndex));
  const uncovered = allWords.filter(w => !covered.has(w) && w.length >= 2);
  const MAX_TRANSLATE = 500; // 只翻译前500个高频词（约8分钟）
  const toTranslate = uncovered.slice(0, MAX_TRANSLATE);
  console.log(`   Already covered (580 list): ${allWords.length - uncovered.length}`);
  console.log(`   Need translation: ${uncovered.length}, translating top ${toTranslate.length}`);

  // 3. 构建词典：从580词表开始
  const dict = {};

  // 580词的释义（取第一条）
  for (const [word, meanings] of Object.entries(vocabIndex)) {
    dict[word] = meanings[0] || word;
  }

  // 4. 翻译高频未覆盖单词
  if (toTranslate.length > 0) {
    console.log('🌐 Translating top-frequency words via API...');
    console.log('   (this will take ~8 minutes, please wait)');
    const translations = await translateBatch(toTranslate);
    console.log(`   Got ${Object.keys(translations).length} translations`);

    // 合并
    for (const [word, meaning] of Object.entries(translations)) {
      dict[word] = meaning;
    }
  }

  // 5. 输出
  console.log(`📁 Writing dictionary: ${Object.keys(dict).length} entries`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dict, null, 2), 'utf-8');
  const size = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
  console.log(`   File size: ${size} KB`);
  console.log('✅ Done!');
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
