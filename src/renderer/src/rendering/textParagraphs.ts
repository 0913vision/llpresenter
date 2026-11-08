export const BULLET_INDENT = 90 / 86;
export const BULLET_GAP = 23 / 86;
export const BULLET_STYLE = {
  '--bullet-indent': `${BULLET_INDENT}em`,
  '--bullet-gap': `${BULLET_GAP}em`,
  '--bullet-offset': `${-7 / 86}em`,
} as const;

/** Preserves empty paragraphs and leaves automatic wrapping to the text frame. */
export function textParagraphs(lines: readonly string[]): readonly string[] {
  return lines.flatMap(line => line.split(/\r?\n/u));
}
