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
