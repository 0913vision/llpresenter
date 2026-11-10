/** Rejoins the source screen's Bible rows before broadcast wraps at its own width. */
export function broadcastBibleFlow(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
}
