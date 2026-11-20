/** Joins measured rows while retaining authored newlines inside each row. */
export function broadcastBibleFlow(lines: readonly string[]): string {
  return lines
    .map(line => line.replace(/^[^\S\r\n]+|[^\S\r\n]+$/gu, ''))
    .filter(Boolean)
    .join(' ');
}
