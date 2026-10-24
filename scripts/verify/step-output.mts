/**
 * Hands a stream's text to `onText` as it arrives. One UTF-8 decoder per
 * stream keeps a character that is split across two chunks (such as `×`)
 * whole.
 */
export function readText(
  stream: NodeJS.ReadableStream,
  onText: (text: string) => void,
): void {
  stream.setEncoding('utf8');
  stream.on('data', (text: string) => onText(text));
}

/**
 * Keeps the last `limit` characters of a step's output and says how many
 * came before them.
 */
export class TailBuffer {
  private readonly chunks: string[] = [];
  private keptChars = 0;
  private droppedChars = 0;

  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  /** Adds the next piece of output and drops whole pieces that fall out. */
  push(text: string): void {
    this.chunks.push(text);
    this.keptChars += text.length;
    this.dropOldChunks();
  }

  /** Returns the kept output, after a line that counts what was dropped. */
  text(): string {
    const joined = this.chunks.join('');
    const overflow = Math.max(0, joined.length - this.limit);
    const dropped = this.droppedChars + overflow;
    const kept = joined.slice(overflow);
    if (dropped === 0) return kept;
    return `[verify dropped the first ${dropped} characters of this output]\n${kept}`;
  }

  private dropOldChunks(): void {
    let oldest = this.chunks[0];
    while (
      oldest !== undefined &&
      this.keptChars - oldest.length >= this.limit
    ) {
      this.chunks.shift();
      this.keptChars -= oldest.length;
      this.droppedChars += oldest.length;
      oldest = this.chunks[0];
    }
  }
}
