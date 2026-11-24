import type {Hymn, Hymnal} from '@core/schema/songs/hymn';
import newHymnal from './newHymnal.json';
import unifiedHymnal from './unifiedHymnal.json';

/** What each hymnal is called. */
export const HYMNAL_NAMES = {
  new: '새찬송가',
  unified: '통일찬송가',
} as const satisfies Readonly<Record<Hymnal, string>>;

/** The titles of each hymnal, the one of number 1 first. */
const TITLES: Readonly<Record<Hymnal, readonly string[]>> = {
  new: newHymnal,
  unified: unifiedHymnal,
};

/** The title a hymn has in its hymnal. */
export function hymnTitle({hymnal, number}: Hymn): string {
  return TITLES[hymnal][number - 1] ?? '';
}

/** A hymn and its number as they are written, such as 새찬송가 91장. */
export function hymnLabel({hymnal, number}: Hymn): string {
  return `${HYMNAL_NAMES[hymnal]} ${number}장`;
}

/** 새찬송가 91장, 통일 찬송가 91장, 찬송가 91장, and 91장 alone. */
const HYMN = /^(새|통일|구)?\s*(?:찬송가?)?\s*(\d{1,3})\s*장(?:\s+(.*))?$/u;

/** A hymn that a row names, and what the row says after it. */
export interface NamedHymn {
  readonly hymn: Hymn;
  readonly rest: string;
}

/** The hymn that a row starts with; without a hymnal it is of 새찬송가. */
export function hymnAt(row: string): NamedHymn | null {
  const [, edition, digits, rest = ''] = HYMN.exec(row.trim()) ?? [];
  if (digits === undefined) return null;
  const old = edition === '통일' || edition === '구';
  const hymn: Hymn = {
    hymnal: old ? 'unified' : 'new',
    number: Number(digits),
  };
  if (hymnTitle(hymn) === '') return null;
  return {hymn, rest: rest.trim().replace(/^\((.*)\)$/u, '$1')};
}

function lettersOf(text: string): string {
  return text.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Whether a text is the title of a hymn, however it is spaced. */
export function isTitleOf(hymn: Hymn, text: string): boolean {
  return lettersOf(hymnTitle(hymn)) === lettersOf(text);
}
