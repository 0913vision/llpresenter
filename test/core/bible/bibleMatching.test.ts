import {describe, expect, it} from 'vitest';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {
  BOOK_SUGGESTION_LIMIT,
  exactBibleBook,
  findBibleBooks,
  matchBooks,
} from '@core/bible/bibleMatching';

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const KEYS: Readonly<Record<string, string>> = {
  ㄱ: 'r',
  ㄲ: 'R',
  ㄴ: 's',
  ㄷ: 'e',
  ㄸ: 'E',
  ㄹ: 'f',
  ㅁ: 'a',
  ㅂ: 'q',
  ㅃ: 'Q',
  ㅅ: 't',
  ㅆ: 'T',
  ㅇ: 'd',
  ㅈ: 'w',
  ㅉ: 'W',
  ㅊ: 'c',
  ㅋ: 'z',
  ㅌ: 'x',
  ㅍ: 'v',
  ㅎ: 'g',
  ㅏ: 'k',
  ㅐ: 'o',
  ㅑ: 'i',
  ㅒ: 'O',
  ㅓ: 'j',
  ㅔ: 'p',
  ㅕ: 'u',
  ㅖ: 'P',
  ㅗ: 'h',
  ㅛ: 'y',
  ㅜ: 'n',
  ㅠ: 'b',
  ㅡ: 'm',
  ㅣ: 'l',
  ㅘ: 'hk',
  ㅙ: 'ho',
  ㅚ: 'hl',
  ㅝ: 'nj',
  ㅞ: 'np',
  ㅟ: 'nl',
  ㅢ: 'ml',
  ㄳ: 'rt',
  ㄵ: 'sw',
  ㄶ: 'sg',
  ㄺ: 'fr',
  ㄻ: 'fa',
  ㄼ: 'fq',
  ㄽ: 'ft',
  ㄾ: 'fx',
  ㄿ: 'fv',
  ㅀ: 'fg',
  ㅄ: 'qt',
};

function initialsOf(text: string): string {
  return Array.from(text, character => {
    const syllable = character.charCodeAt(0) - 0xac00;
    return syllable >= 0 && syllable < 11172
      ? (INITIALS[Math.floor(syllable / 588)] ?? character)
      : character;
  }).join('');
}

function keyboardOf(text: string): string {
  return Array.from(text, character => {
    const syllable = character.charCodeAt(0) - 0xac00;
    if (syllable < 0 || syllable >= 11172) return KEYS[character] ?? character;
    const initial = INITIALS[Math.floor(syllable / 588)] ?? '';
    const medial = MEDIALS[Math.floor(syllable / 28) % 21] ?? '';
    const final = FINALS[syllable % 28] ?? ' ';
    return `${KEYS[initial] ?? ''}${KEYS[medial] ?? ''}${KEYS[final] ?? ''}`;
  }).join('');
}

// NOTE(0913vision): Abbreviation initials precede full-name initials; other
// collisions go to the earlier book in canonical order.
const FULL_INITIAL_WINNER: Readonly<Record<number, number>> = {
  22: 18,
  29: 62,
  63: 62,
  65: 13,
};
const SHORT_INITIAL_WINNER: Readonly<Record<number, number>> = {
  53: 10,
  55: 14,
  63: 62,
  64: 11,
};

describe('all 66 book search keys', () => {
  it.each(BIBLE_BOOKS)(
    'finds $korean by name, abbreviation and keyboard keys',
    book => {
      for (const text of [book.korean, book.koreanShort]) {
        expect(findBibleBooks(text)[0]?.id, text).toBe(book.id);
        expect(findBibleBooks(keyboardOf(text))[0]?.id, keyboardOf(text)).toBe(
          book.id,
        );
      }
      const fullInitials = initialsOf(book.korean);
      for (const input of [fullInitials, keyboardOf(fullInitials)]) {
        expect(findBibleBooks(input)[0]?.id, input).toBe(
          FULL_INITIAL_WINNER[book.id] ?? book.id,
        );
      }
      if (book.koreanShort.length >= 2) {
        const shortInitials = initialsOf(book.koreanShort);
        for (const input of [shortInitials, keyboardOf(shortInitials)]) {
          expect(findBibleBooks(input)[0]?.id, input).toBe(
            SHORT_INITIAL_WINNER[book.id] ?? book.id,
          );
        }
      }
    },
  );

  it.each([
    ['수', 6],
    ['삿', 7],
    ['사', 23],
    ['요', 43],
    ['전', 21],
    ['ㅅㅅㄱ', 7],
    ['ㄷㅅㄹㄴㄱㅈㅅ', 52],
    ['ㅅㅈ', 52],
    ['tw', 52],
    ['ㄱㅈ', 46],
    ['tkftjs', 52],
    ['tkt', 7],
    ['요한1서', 62],
    ['요한2서', 63],
    ['요한3서', 64],
  ])('ranks %s first as book %i', (input, id) => {
    expect(findBibleBooks(input)[0]?.id).toBe(id);
  });

  it('ranks exact abbreviations before name prefixes and containment', () => {
    expect(
      findBibleBooks('사')
        .slice(0, 5)
        .map(book => book.id),
    ).toEqual([23, 7, 9, 10, 44]);
  });
});

describe('four-field book candidates', () => {
  it('matches short names with invisible input markers and Korean composition', () => {
    expect(findBibleBooks('\u200b\ud569\ufeff').map(book => book.id)).toContain(
      35,
    );
    expect(exactBibleBook('\u200b\ud569\ufeff')?.id).toBe(35);
    expect(findBibleBooks('\u314e\u314f\u3142').map(book => book.id)).toContain(
      35,
    );
  });
  it('distinguishes the reported chd typo from Genesis keyboard input', () => {
    for (const input of ['chd', '총']) {
      expect(exactBibleBook(input)).toBeUndefined();
      expect(findBibleBooks(input)).toEqual([]);
    }
    for (const input of ['ckd', 'ckdtprl', '창세기', '창', 'Genesis', 'GEN']) {
      expect(exactBibleBook(input)?.id).toBe(1);
    }
    for (const input of ['ㅊㅏ', '차', '창세', 'ckdtp', 'nesis']) {
      expect(findBibleBooks(input).map(book => book.id)).toEqual([1]);
    }
  });

  it.each([
    ['ezk', 'eze', 26],
    ['jol', 'joe', 29],
    ['jnh', 'jon', 32],
    ['nam', 'nah', 34],
    ['mrk', 'mar', 41],
    ['jhn', 'joh', 43],
    ['php', 'phi', 50],
  ])('recognizes current %s and retained %s codes', (current, previous, id) => {
    for (const code of [current, current.toUpperCase(), previous]) {
      expect(exactBibleBook(code)?.id).toBe(id);
      expect(matchBooks(code).map(book => book.id)).toEqual([id]);
      expect(findBibleBooks(code).some(book => book.id === id)).toBe(true);
    }
  });

  it('keeps every containment match even when a short name matches exactly', () => {
    const matches = findBibleBooks('요');
    expect(matches.map(book => book.id)).toEqual([
      43, 62, 63, 64, 29, 32, 66, 18,
    ]);
    expect(exactBibleBook('요')?.id).toBe(43);
    expect(findBibleBooks('서')).toHaveLength(
      BIBLE_BOOKS.filter(book => book.korean.includes('서')).length,
    );
    expect(findBibleBooks('서').length).toBeGreaterThan(8);
  });

  it.each([
    ['베', [60, 61, 49]],
    ['dhkd', [11, 12]],
    ['왕', [11, 12]],
    ['qpe', [60, 61]],
    ['dPfp', [24, 25]],
    ['요한', [43, 62, 63, 64, 66]],
  ])('matches jamo and IME-off text %s in relevance order', (input, ids) => {
    expect(findBibleBooks(input).map(book => book.id)).toEqual(ids);
  });

  it('matches English names and codes while retaining all candidates', () => {
    expect(findBibleBooks('GEN').map(book => book.id)).toEqual([1]);
    expect(findBibleBooks('John').map(book => book.id)).toEqual([
      43, 62, 63, 64,
    ]);
    expect(exactBibleBook('1 John')?.id).toBe(62);
    expect(exactBibleBook('ckd')?.id).toBe(1);
    expect(exactBibleBook('베')).toBeUndefined();
    expect(findBibleBooks('')).toEqual([]);
    expect(findBibleBooks('unknown')).toEqual([]);
  });
});

describe('matchBooks', () => {
  it('maps common English abbreviations before Korean keyboard matching', () => {
    for (const [name, id] of [
      ['Jn', 43],
      ['Ex', 2],
      ['Rom', 45],
      ['1Co', 46],
      ['2 Jn', 63],
    ] as const) {
      expect(matchBooks(name).map(book => book.id)).toEqual([id]);
    }
  });
  it('recognizes every full and short Korean and English name exactly', () => {
    for (const book of BIBLE_BOOKS) {
      for (const name of [
        book.korean,
        book.koreanShort,
        book.english,
        book.englishShort,
      ]) {
        expect(
          matchBooks(name).map(match => match.id),
          name,
        ).toEqual([book.id]);
      }
    }
  });

  it.each([
    '창',
    '창세',
    '차',
    'ckd',
    'ckdtp',
    'GEN',
    'Genesis',
    ' 창 세 기 ',
    '창세기'.normalize('NFD'),
  ])('completes %j to Genesis', name => {
    expect(matchBooks(name).map(book => book.korean)).toEqual(['창세기']);
  });

  it('offers ambiguous prefixes in canonical order and gives exact names priority', () => {
    expect(matchBooks('베').map(book => book.korean)).toEqual([
      '베드로전서',
      '베드로후서',
      '에베소서',
    ]);
    expect(matchBooks('요한').map(book => book.id)).toEqual([
      43, 62, 63, 64, 66,
    ]);
    expect(matchBooks('요').map(book => book.korean)).toEqual(['요한복음']);
    expect(matchBooks('1 John').map(book => book.korean)).toEqual(['요한일서']);
  });

  it('matches compound vowels and final consonants, including IME-off keys', () => {
    expect(matchBooks('왕').map(book => book.id)).toEqual([11, 12]);
    expect(matchBooks('dhkd').map(book => book.id)).toEqual([11, 12]);
    expect(matchBooks('qpe').map(book => book.id)).toEqual([60, 61]);
    expect(matchBooks('tn').map(book => book.id)).toEqual([6]);
    expect(matchBooks('dPfp').map(book => book.id)).toEqual([24, 25]);
  });

  it('bounds suggestions and rejects empty or unknown book names', () => {
    const matches = matchBooks('서');
    expect(matches).toHaveLength(BOOK_SUGGESTION_LIMIT);
    expect(matches.map(book => book.id)).toEqual(
      [...matches.map(book => book.id)].sort((a, b) => a - b),
    );
    expect(matchBooks(' ')).toEqual([]);
    expect(matchBooks('not a book')).toEqual([]);
  });
});
