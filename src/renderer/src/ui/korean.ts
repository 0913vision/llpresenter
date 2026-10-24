const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const FINAL_CONSONANT_COUNT = 28;

const DIGITS_WITH_FINAL_CONSONANT = new Set(['0', '1', '3', '6', '7', '8']);
const LETTERS_WITH_FINAL_CONSONANT = new Set(['l', 'm', 'n', 'r']);
const READABLE = /[0-9a-z가-힣]/i;

function endsWithConsonant(character: string): boolean {
  const code = character.charCodeAt(0);
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
    return (code - HANGUL_FIRST) % FINAL_CONSONANT_COUNT !== 0;
  }
  return (
    DIGITS_WITH_FINAL_CONSONANT.has(character) ||
    LETTERS_WITH_FINAL_CONSONANT.has(character.toLowerCase())
  );
}

/**
 * Returns the object particle that follows `word` when it is read aloud:
 * 을 after a final consonant (모니터 3을), 를 otherwise (모니터 2를).
 */
export function objectParticle(word: string): '을' | '를' {
  return endsInConsonant(word) ? '을' : '를';
}

/**
 * Returns the particle "and, with" that follows `word` when it is read aloud:
 * 과 after a final consonant (평상시 출력과), 와 otherwise (출력 켜기와).
 */
export function withParticle(word: string): '과' | '와' {
  return endsInConsonant(word) ? '과' : '와';
}

function endsInConsonant(word: string): boolean {
  const last = lastReadable(word);
  return last !== undefined && endsWithConsonant(last);
}

function lastReadable(word: string): string | undefined {
  for (let index = word.length - 1; index >= 0; index--) {
    const character = word.charAt(index);
    if (READABLE.test(character)) return character;
  }
  return undefined;
}
