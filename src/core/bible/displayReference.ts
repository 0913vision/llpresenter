/** Displays old and new range separators consistently without changing stored data. */
export function displayReference(ref: string): string {
  return ref.replace(/(?<=\d)\s*[-~\uFF5E]\s*(?=\d)/gu, '~');
}
