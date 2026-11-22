import newHymnal from './newHymnal.json';
import unifiedHymnal from './unifiedHymnal.json';

/** The titles of each hymnal, the first one of number 1. */
const TITLES = {
  새찬송가: newHymnal,
  통일찬송가: unifiedHymnal,
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type Hymnal = keyof typeof TITLES;

/** One hymn of a hymnal. */
export interface Hymn {
  readonly hymnal: Hymnal;
  readonly number: number;
  readonly title: string;
}

/** A hymn that a text names, and what the text says after it. */
export interface NamedHymn {
  readonly hymn: Hymn;
  readonly rest: string;
}

/** 새찬송가 91장, 통일 찬송가 91장, 찬송가 91장, and 91장 alone. */
const HYMN = /^(새|통일|구)?\s*(?:찬송가?)?\s*(\d{1,3})\s*장(?:\s+(.*))?$/u;

/** The hymn that a row starts with; without a hymnal it is of 새찬송가. */
export function hymnAt(row: string): NamedHymn | null {
  const [, edition, digits, rest = ''] = HYMN.exec(row.trim()) ?? [];
  if (digits === undefined) return null;
  const hymnal =
    edition === '통일' || edition === '구' ? '통일찬송가' : '새찬송가';
  const number = Number(digits);
  const title = TITLES[hymnal][number - 1];
  if (title === undefined) return null;
  return {
    hymn: {hymnal, number, title},
    rest: rest.trim().replace(/^\((.*)\)$/u, '$1'),
  };
}

/** The number of a hymn as a title slide writes it. */
export function hymnLabel({hymnal, number}: Hymn): string {
  return `${hymnal} ${number}장`;
}

function lettersOf(text: string): string {
  return text.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Whether a text is the title of a hymn, however it is spaced. */
export function isTitleOf(hymn: Hymn, text: string): boolean {
  return lettersOf(hymn.title) === lettersOf(text);
}
