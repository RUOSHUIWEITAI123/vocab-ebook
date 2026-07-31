/**
 * Word Bank — 生词本
 * Stores words in localStorage, shows panel for review.
 */

const STORAGE_KEY = 'vocab-wordbank';

let wordBank = [];
let updateCallback = null;

/** Initialize word bank from localStorage */
export function initWordBank() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    wordBank = saved;
  } catch (e) { wordBank = []; }
}

/** Add a word to the bank */
export function addWord(word, root, meaning) {
  const entry = {
    word: word,
    root: root || word,
    meaning: meaning || '',
    addedAt: Date.now()
  };

  // Check duplicate
  const exists = wordBank.find(w => w.root === entry.root);
  if (exists) return false;

  wordBank.push(entry);
  save();
  return true;
}

/** Remove a word from the bank */
export function removeWord(root) {
  wordBank = wordBank.filter(w => w.root !== root);
  save();
}

/** Check if a word is in the bank */
export function isInBank(root) {
  return wordBank.some(w => w.root === root);
}

/** Toggle word in/out of bank */
export function toggleWord(word, root, meaning) {
  if (isInBank(root)) {
    removeWord(root);
    return false;
  } else {
    addWord(word, root, meaning);
    return true;
  }
}

/** Get all banked words */
export function getWords() {
  return [...wordBank];
}

/** Get count */
export function getCount() {
  return wordBank.length;
}

/** Register UI update callback */
export function onUpdate(fn) { updateCallback = fn; }

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wordBank));
  if (updateCallback) updateCallback();
}
