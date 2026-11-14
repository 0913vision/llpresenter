/** Keeps the main title box and any subtitle that is not English-only. */
export function songTitleLines(
  lines: readonly string[],
  titleLineCount: number | undefined,
): readonly string[] {
  const count = titleLineCount ?? 1;
  const subtitle = lines.slice(count).join('\n');
  return /\p{Script=Latin}/u.test(subtitle) &&
    !/\p{Script=Hangul}/u.test(subtitle)
    ? lines.slice(0, count)
    : lines;
}
