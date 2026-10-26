const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const INITIAL_QUERY = new RegExp(`^[${INITIALS}]+$`, 'u');
const FIRST_SYLLABLE = 0xac00;
const LAST_SYLLABLE = 0xd7a3;
const SYLLABLES_PER_INITIAL = 21 * 28;

/** Library search text: NFC, lower case, and no whitespace. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/gu, '');
}

/** Each Hangul syllable as its initial consonant; other characters stay. */
export function searchInitials(normalized: string): string {
  let initials = '';
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    initials +=
      code >= FIRST_SYLLABLE && code <= LAST_SYLLABLE
        ? (INITIALS[
            Math.floor((code - FIRST_SYLLABLE) / SYLLABLES_PER_INITIAL)
          ] ?? character)
        : character;
  }
  return initials;
}

/** A query made only of initial consonants, such as ㅁㅂㅇ, matches initials. */
export function isInitialQuery(normalized: string): boolean {
  return INITIAL_QUERY.test(normalized);
}

/** Where a query matched a text, in the text's own UTF-16 offsets. */
export interface SearchRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The first part of `text` that a library search for `query` matches, by the
 * same rules as the index, or `undefined`.
 */
export function searchRange(
  text: string,
  query: string,
): SearchRange | undefined {
  const needle = normalizeSearch(query);
  if (needle === '') return undefined;
  const source = text.normalize('NFC');
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of source) {
    for (const unit of normalizeSearch(character)) {
      normalized += unit;
      starts.push(offset);
      ends.push(offset + character.length);
    }
    offset += character.length;
  }
  const haystack = isInitialQuery(needle)
    ? searchInitials(normalized)
    : normalized;
  const at = haystack.indexOf(needle);
  const start = starts[at];
  const end = ends[at + needle.length - 1];
  return at < 0 || start === undefined || end === undefined
    ? undefined
    : {start, end};
}
