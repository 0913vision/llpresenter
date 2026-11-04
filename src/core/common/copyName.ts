const COPY_WORD = '복사본';
const COPY_ENDING = /\s+복사본(?:\s+\d+)?$/;

/** How a name is compared with the ones already taken. */
export interface CopyNameOptions {
  /** The longest name the owner allows; the original is cut to make room. */
  readonly maxLength?: number | undefined;
  /** Brings a name to the form the owner compares; trimming and NFC by default. */
  readonly normalize?: ((name: string) => string) | undefined;
}

function trimmed(name: string): string {
  return name.trim().normalize('NFC');
}

/**
 * The name of a copy: `<name> 복사본`, then `<name> 복사본 2`, `3`, and so on
 * until no name in `taken` is the same. A name that already ends in 복사본, or
 * 복사본 and a number, is copied from what stands before that ending, so a copy
 * of a copy never reads 복사본 복사본. This is the one rule for every copy the
 * app names: 매크로, 테마, 곡, and 템플릿.
 */
export function copyName(
  name: string,
  taken: Iterable<string>,
  {maxLength, normalize = trimmed}: CopyNameOptions = {},
): string {
  const used = new Set([...taken].map(normalize));
  const original = normalize(name);
  const stem = normalize(original.replace(COPY_ENDING, ''));
  const base = stem === '' ? original : stem;
  for (let number = 1; ; number++) {
    const ending = ` ${COPY_WORD}${number === 1 ? '' : ` ${number}`}`;
    const letters = Array.from(base.normalize('NFC'));
    const room =
      maxLength === undefined ? letters.length : maxLength - ending.length;
    const candidate = normalize(
      `${letters.slice(0, Math.max(room, 0)).join('')}${ending}`,
    );
    if (!used.has(candidate)) return candidate;
  }
}
