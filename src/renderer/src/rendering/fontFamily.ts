const FALLBACK_FONTS = "'Pretendard Variable', sans-serif";

/** Canonical family used for PowerPoint's Korean NanumSquare face names. */
export function canonicalFontName(font: string): string {
  return /^나눔스퀘어(?: (?:ExtraBold|Bold))?$/u.test(font)
    ? 'NanumSquare'
    : font;
}

/** A CSS font family for a saved font name, with Pretendard as the fallback. */
export function fontFamilyFor(font: string): string {
  const escaped = canonicalFontName(font).replace(
    /["\\\p{Cc}]/gu,
    character => `\\${character.charCodeAt(0).toString(16)} `,
  );
  return `"${escaped}", ${FALLBACK_FONTS}`;
}
