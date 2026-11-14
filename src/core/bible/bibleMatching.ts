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

const COPIBLE_CODES: Readonly<Record<number, string>> = {
  26: 'ezk',
  29: 'jol',
  32: 'jnh',
  34: 'nam',
  41: 'mrk',
  43: 'jhn',
  50: 'php',
};

/** Common English abbreviations in canonical book order. */
const ENGLISH_ABBREVIATIONS = [
  'Gen',
  'Ex',
  'Lev',
  'Num',
  'Deut',
  'Josh',
  'Judg',
  'Ruth',
  '1Sam',
  '2Sam',
  '1Kgs',
  '2Kgs',
  '1Chr',
  '2Chr',
  'Ezra',
  'Neh',
  'Esth',
  'Job',
  'Ps',
  'Prov',
  'Eccl',
  'Song',
  'Isa',
  'Jer',
  'Lam',
  'Ezek',
  'Dan',
  'Hos',
  'Joel',
  'Amos',
  'Obad',
  'Jonah',
  'Mic',
  'Nah',
  'Hab',
  'Zeph',
  'Hag',
  'Zech',
  'Mal',
  'Matt',
  'Mark',
  'Luke',
  'Jn',
  'Acts',
  'Rom',
  '1Co',
  '2Co',
  'Gal',
  'Eph',
  'Phil',
  'Col',
  '1Thess',
  '2Thess',
  '1Tim',
  '2Tim',
  'Titus',
  'Philem',
  'Heb',
  'Jas',
  '1Pet',
  '2Pet',
  '1Jn',
  '2Jn',
  '3Jn',
  'Jude',
  'Rev',
] as const;
const ADDITIONAL_ENGLISH_ABBREVIATIONS: Readonly<
  Record<number, readonly string[]>
> = {
  2: ['Exod'],
  6: ['Jos'],
  7: ['Jdg'],
  9: ['1Sa'],
  10: ['2Sa'],
  11: ['1Ki'],
  12: ['2Ki'],
  13: ['1Ch'],
  14: ['2Ch'],
  17: ['Est'],
  19: ['Psa', 'Pss'],
  20: ['Pr'],
  21: ['Ecc'],
  22: ['Cant'],
  26: ['Ezk'],
  29: ['Jl'],
  31: ['Ob'],
  32: ['Jon'],
  34: ['Na'],
  36: ['Zep'],
  37: ['Hg'],
  38: ['Zec'],
  40: ['Mt'],
  41: ['Mk'],
  42: ['Lk'],
  44: ['Ac'],
  45: ['Ro'],
  46: ['1Cor'],
  47: ['2Cor'],
  50: ['Php'],
  52: ['1Th'],
  53: ['2Th'],
  54: ['1Ti'],
  55: ['2Ti'],
  56: ['Tit'],
  57: ['Phm'],
  59: ['Jm'],
  60: ['1Pe'],
  61: ['2Pe'],
  65: ['Jud'],
  66: ['Re'],
};

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u200b-\u200d\u2060\ufeff]+/gu, '');
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

const names = BIBLE_BOOKS.map(book => {
  const code = COPIBLE_CODES[book.id];
  return {
    book,
    plain: [
      book.korean,
      book.koreanShort,
      book.english,
      book.englishShort,
      ENGLISH_ABBREVIATIONS[book.id - 1] ?? '',
      ...(ADDITIONAL_ENGLISH_ABBREVIATIONS[book.id] ?? []),
      ...(code === undefined ? [] : [code]),
    ].map(normalize),
    korean: [book.korean, book.koreanShort].map(letters),
  };
});

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
  return (
    names.find(entry => entry.plain.includes(plain)) ??
    names.find(entry => entry.korean.includes(keyboard))
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

/** Preserves exact-name priority and the lookup suggestion cap. */
export function matchBooks(input: string): readonly BibleBook[] {
  const exact = exactBibleBook(input);
  return exact
    ? [exact]
    : findBibleBooks(input).slice(0, BOOK_SUGGESTION_LIMIT);
}
