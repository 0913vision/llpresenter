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

// NOTE(0913vision): The requested keyboard alias is not the literal 두벌식
// spelling of 살전; keep this exact alias without adding fuzzy matching.
const KEYBOARD_ALIASES: Readonly<Record<number, readonly string[]>> = {
  52: ['tkftjs'],
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

function initials(text: string): string {
  return normalize(
    Array.from(text.normalize('NFC'), character => {
      const code = character.charCodeAt(0);
      return code >= FIRST_SYLLABLE && code <= LAST_SYLLABLE
        ? (INITIALS[
            Math.floor((code - FIRST_SYLLABLE) / SYLLABLES_PER_INITIAL)
          ] ?? character)
        : character;
    }).join(''),
  );
}

const names = BIBLE_BOOKS.map(book => {
  const code = COPIBLE_CODES[book.id];
  const numberedJohn =
    book.id >= 62 && book.id <= 64 ? `요한${book.id - 61}서` : undefined;
  return {
    book,
    short: [
      book.koreanShort,
      book.englishShort,
      ENGLISH_ABBREVIATIONS[book.id - 1] ?? '',
      ...(ADDITIONAL_ENGLISH_ABBREVIATIONS[book.id] ?? []),
      ...(KEYBOARD_ALIASES[book.id] ?? []),
      ...(code === undefined ? [] : [code]),
    ].map(normalize),
    full: [
      book.korean,
      book.english,
      ...(numberedJohn === undefined ? [] : [numberedJohn]),
    ].map(normalize),
    shortLetters: letters(book.koreanShort),
    fullLetters: letters(book.korean),
    shortInitials:
      book.koreanShort.length >= 2 ? initials(book.koreanShort) : '',
    fullInitials: initials(book.korean),
  };
});

function keyboardText(input: string): string {
  return Array.from(
    input,
    key => SHIFTED[key] ?? KEYBOARD[key.toLowerCase()] ?? key,
  ).join('');
}

interface Query {
  readonly plain: string;
  readonly keyboard: string;
  readonly originalLetters: string;
  readonly keyboardLetters: string;
  readonly initialKeys: readonly string[];
  readonly partialLetters: boolean;
}

function queryOf(input: string): Query {
  const keyboard = keyboardText(input);
  const originalLetters = letters(input);
  const keyboardLetters = letters(keyboard);
  const initialKeys = [originalLetters, keyboardLetters].filter(value =>
    /^[\u1100-\u1112]+$/u.test(value),
  );
  return {
    plain: normalize(input),
    keyboard: normalize(keyboard),
    originalLetters,
    keyboardLetters,
    initialKeys,
    partialLetters:
      /[\u1100-\u1112]$/u.test(normalize(keyboard)) && /[a-z]/iu.test(input),
  };
}

function rank(entry: (typeof names)[number], query: Query): number {
  const {
    plain,
    keyboard,
    originalLetters,
    keyboardLetters,
    initialKeys,
    partialLetters,
  } = query;
  const exactLetters = (value: string): boolean =>
    value === originalLetters || value === keyboardLetters;
  const starts = (value: string): boolean =>
    value.startsWith(plain) || value.startsWith(keyboard);
  const letterStarts = (value: string): boolean =>
    partialLetters && value.startsWith(keyboardLetters);
  if (entry.short.includes(plain) || exactLetters(entry.shortLetters)) return 0;
  if (entry.full.includes(plain) || exactLetters(entry.fullLetters)) return 1;
  if (entry.short.some(starts) || letterStarts(entry.shortLetters)) return 2;
  if (entry.full.some(starts) || letterStarts(entry.fullLetters)) return 3;
  if (entry.shortInitials !== '' && initialKeys.includes(entry.shortInitials)) {
    return 4;
  }
  if (initialKeys.includes(entry.fullInitials)) return 5;
  if (
    entry.shortInitials !== '' &&
    initialKeys.some(key => entry.shortInitials.startsWith(key))
  ) {
    return 6;
  }
  if (initialKeys.some(key => entry.fullInitials.startsWith(key))) return 6;
  if (
    [...entry.short, ...entry.full].some(value => value.includes(plain)) ||
    entry.shortLetters.includes(originalLetters) ||
    entry.fullLetters.includes(originalLetters) ||
    entry.shortLetters.includes(keyboardLetters) ||
    entry.fullLetters.includes(keyboardLetters)
  ) {
    return 8;
  }
  return 9;
}

export function exactBibleBook(input: string): BibleBook | undefined {
  const query = queryOf(input);
  if (query.plain === '') return undefined;
  return (
    names.find(entry => rank(entry, query) === 0)?.book ??
    names.find(entry => rank(entry, query) === 1)?.book
  );
}

/** Returns all matches in relevance order, breaking ties by canonical order. */
export function findBibleBooks(input: string): readonly BibleBook[] {
  const query = queryOf(input);
  if (query.plain === '') return [];
  return names
    .map(entry => ({entry, score: rank(entry, query)}))
    .filter(value => value.score < 9)
    .sort((a, b) => a.score - b.score || a.entry.book.id - b.entry.book.id)
    .map(({entry}) => entry.book);
}

/** Preserves exact-name priority and the lookup suggestion cap. */
export function matchBooks(input: string): readonly BibleBook[] {
  const exact = exactBibleBook(input);
  return exact
    ? [exact]
    : findBibleBooks(input).slice(0, BOOK_SUGGESTION_LIMIT);
}
