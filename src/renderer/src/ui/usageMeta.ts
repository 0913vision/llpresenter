/** Includes usage details only when at least one item uses the target. */
export function usageMeta(count: number, text: string): readonly string[] {
  return count > 0 ? [text] : [];
}
