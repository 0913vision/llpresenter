import {FailureScanner} from './failure-scanner.mts';

const MAX_LINE_CHARS = 4096;
const LINE_BREAK = /\r?\n/;

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
  private readonly limit: number;
  private readonly chunks: string[] = [];
  private keptChars = 0;
  private droppedChars = 0;

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

/**
 * Splits one stream's text into lines. It holds an unfinished last line until
 * the rest arrives, and reads at most 4096 characters of each line.
 */
export class LineSplitter {
  private partialLine = '';

  /** Reads the next piece of text and hands over each line it completes. */
  push(text: string, onLine: (line: string) => void): void {
    const lines = (this.partialLine + text).split(LINE_BREAK);
    this.partialLine = (lines.pop() ?? '').slice(0, MAX_LINE_CHARS);
    for (const line of lines) onLine(line.slice(0, MAX_LINE_CHARS));
  }

  /** Hands over the unfinished last line, if there is one. */
  flush(onLine: (line: string) => void): void {
    if (this.partialLine !== '') onLine(this.partialLine);
    this.partialLine = '';
  }
}

/** One step's captured output, and the lines that name what failed in it. */
export interface CapturedOutput {
  readonly output: string;
  readonly failureLines: readonly string[];
}

/**
 * Captures one step's output. The kept text is capped, and "What failed"
 * reads every line of both streams. Each stream keeps its own unfinished
 * line, so stdout and stderr can't merge into one line.
 */
export class StepCapture {
  private readonly output: TailBuffer;
  private readonly failures = new FailureScanner();
  private readonly stdoutLines = new LineSplitter();
  private readonly stderrLines = new LineSplitter();
  private readonly readLine = (line: string): void => {
    this.failures.readLine(line);
  };

  constructor(maxKeptChars: number) {
    this.output = new TailBuffer(maxKeptChars);
  }

  /** Adds text that the step wrote to stdout. */
  stdout(text: string): void {
    this.output.push(text);
    this.stdoutLines.push(text, this.readLine);
  }

  /** Adds text that the step wrote to stderr. */
  stderr(text: string): void {
    this.output.push(text);
    this.stderrLines.push(text, this.readLine);
  }

  /** Adds a line of verify's own, which names no failure. */
  note(line: string): void {
    this.output.push(`\n${line}\n`);
  }

  /** Reads the unfinished lines and returns what was captured. */
  finish(): CapturedOutput {
    this.stdoutLines.flush(this.readLine);
    this.stderrLines.flush(this.readLine);
    return {output: this.output.text(), failureLines: this.failures.finish()};
  }
}
