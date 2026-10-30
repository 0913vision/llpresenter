import {BIBLE_BOOKS, type BibleBook} from './bibleBooks';

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const FIRST_SYLLABLE = 0xac00;
const LAST_SYLLABLE = 0xd7a3;
const FINAL_COUNT = 28;
const SYLLABLES_PER_INITIAL = VOWELS.length * FINAL_COUNT;
const COMPOUNDS: Readonly<Record<string, string>> = {
  ㄳ: 'ㄱㅅ',
  ㄵ: 'ㄴㅈ',
  ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ',
  ㄻ: 'ㄹㅁ',
  ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ',
  ㄾ: 'ㄹㅌ',
  ㄿ: 'ㄹㅍ',
  ㅀ: 'ㄹㅎ',
  ㅄ: 'ㅂㅅ',
  ㅘ: 'ㅗㅏ',
  ㅙ: 'ㅗㅐ',
  ㅚ: 'ㅗㅣ',
  ㅝ: 'ㅜㅓ',
  ㅞ: 'ㅜㅔ',
  ㅟ: 'ㅜㅣ',
  ㅢ: 'ㅡㅣ',
};
const KEYBOARD: Readonly<Record<string, string>> = {
  q: 'ㅂ',
  w: 'ㅈ',
  e: 'ㄷ',
  r: 'ㄱ',
  t: 'ㅅ',
  y: 'ㅛ',
  u: 'ㅕ',
  i: 'ㅑ',
  o: 'ㅐ',
  p: 'ㅔ',
  a: 'ㅁ',
  s: 'ㄴ',
  d: 'ㅇ',
  f: 'ㄹ',
  g: 'ㅎ',
  h: 'ㅗ',
  j: 'ㅓ',
  k: 'ㅏ',
  l: 'ㅣ',
  z: 'ㅋ',
  x: 'ㅌ',
  c: 'ㅊ',
  v: 'ㅍ',
  b: 'ㅠ',
  n: 'ㅜ',
  m: 'ㅡ',
};
const SHIFTED: Readonly<Record<string, string>> = {
  Q: 'ㅃ',
  W: 'ㅉ',
  E: 'ㄸ',
  R: 'ㄲ',
  T: 'ㅆ',
  O: 'ㅒ',
  P: 'ㅖ',
};
export const BOOK_SUGGESTION_LIMIT = 8;

function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/gu, '');
}

function letters(text: string): string {
  let result = '';
  for (const character of text.normalize('NFC')) {
    const syllable = character.charCodeAt(0) - FIRST_SYLLABLE;
    if (syllable < 0 || character.charCodeAt(0) > LAST_SYLLABLE) {
      result += character;
      continue;
    }
    result += INITIALS[Math.floor(syllable / SYLLABLES_PER_INITIAL)] ?? '';
    result += VOWELS[Math.floor(syllable / FINAL_COUNT) % VOWELS.length] ?? '';
    result += FINALS[(syllable % FINAL_COUNT) - 1] ?? '';
  }
  return normalize(
    Array.from(result, letter => COMPOUNDS[letter] ?? letter).join(''),
  );
}

const names = BIBLE_BOOKS.map(book => ({
  book,
  plain: [book.korean, book.koreanShort, book.english, book.englishShort].map(
    normalize,
  ),
  korean: [book.korean, book.koreanShort].map(letters),
}));

function keyboardLetters(input: string): string {
  return letters(
    Array.from(
      input,
      key => SHIFTED[key] ?? KEYBOARD[key.toLowerCase()] ?? key,
    ).join(''),
  );
}

export function exactBibleBook(input: string): BibleBook | undefined {
  const plain = normalize(input);
  const keyboard = keyboardLetters(input);
  return names.find(
    entry => entry.plain.includes(plain) || entry.korean.includes(keyboard),
  )?.book;
}

/** Returns every containment match in canonical order, at most 66 books. */
export function findBibleBooks(input: string): readonly BibleBook[] {
  const plain = normalize(input);
  if (plain === '') return [];
  const original = letters(input);
  const keyboard = keyboardLetters(input);
  return names
    .filter(
      entry =>
        entry.plain.some(name => name.includes(plain)) ||
        entry.korean.some(
          name => name.includes(original) || name.includes(keyboard),
        ),
    )
    .map(({book}) => book);
}

/** Preserves exact-name priority and the legacy lookup suggestion cap. */
export function matchBooks(input: string): readonly BibleBook[] {
  const exact = exactBibleBook(input);
  return exact
    ? [exact]
    : findBibleBooks(input).slice(0, BOOK_SUGGESTION_LIMIT);
}
