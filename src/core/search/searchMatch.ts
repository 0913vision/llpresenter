import {isInitialQuery, normalizeSearch, searchInitials} from './searchText';

/** A part of a text, from `start` up to `end`, in UTF-16 code units. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

const SPACE = /\s/u;

/**
 * Where the library search finds `query` in `text`, as it searches: case and
 * whitespace do not count, and a query of initial consonants (ㅈㅁ) matches the
 * initials of the syllables. The text is taken in NFC, as `searchSnippet`
 * and the screen show it.
 *
 * @returns The first part of the text that matches, or null.
 */
export function searchMatchRange(
  text: string,
  query: string,
): TextRange | null {
  const wanted = normalizeSearch(query);
  if (wanted === '') return null;
  const initials = isInitialQuery(wanted);
  const shown = text.normalize('NFC');
  const keys: string[] = [];
  const places: TextRange[] = [];
  let at = 0;
  for (const character of shown) {
    const start = at;
    at += character.length;
    if (SPACE.test(character)) continue;
    const lower = character.toLowerCase();
    keys.push(initials ? searchInitials(lower) : lower);
    places.push({start, end: at});
  }
  const unitOf: number[] = [];
  keys.forEach((key, unit) => {
    unitOf.push(...Array.from({length: key.length}, () => unit));
  });
  const found = keys.join('').indexOf(wanted);
  if (found < 0) return null;
  const first = places[unitOf[found] ?? -1];
  const last = places[unitOf[found + wanted.length - 1] ?? -1];
  return first === undefined || last === undefined
    ? null
    : {start: first.start, end: last.end};
}

/** How much of a line is shown around a match at most. */
export const SNIPPET_LENGTH = 40;

/**
 * The part of a long line around a match, with "…" where it was cut, and the
 * match's place in that part.
 */
export function searchSnippet(
  text: string,
  match: TextRange,
): {readonly text: string; readonly match: TextRange} {
  const shown = text.normalize('NFC');
  if (shown.length <= SNIPPET_LENGTH) return {text: shown, match};
  const before = Math.floor((SNIPPET_LENGTH - (match.end - match.start)) / 3);
  const start = Math.max(0, match.start - Math.max(0, before));
  const end = Math.min(
    shown.length,
    Math.max(match.end, start + SNIPPET_LENGTH),
  );
  const head = start > 0 ? '…' : '';
  const tail = end < shown.length ? '…' : '';
  return {
    text: `${head}${shown.slice(start, end)}${tail}`,
    match: {
      start: match.start - start + head.length,
      end: match.end - start + head.length,
    },
  };
}
