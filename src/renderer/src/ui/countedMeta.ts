/** Includes a count line only when the count is above 0. */
export function countedMeta(count: number, text: string): readonly string[] {
  return count > 0 ? [text] : [];
}
