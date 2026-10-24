import {stripVTControlCharacters} from 'node:util';

const MAX_FAILURE_LINES = 20;
const LOOKAHEAD_LINES = 6;
const NOTABLE_LINE =
  /^\s*(?:FAIL\s|×\s|Error: \[vitest-pool|Vitest caught \d+ unhandled)|Unhandled (?:Errors?|Rejection)/;
const ERROR_MESSAGE = /^\s*[A-Za-z]*(?:Error|Exception)\b[^:]*:/;
const SEPARATOR = /⎯+/g;

interface Failure {
  readonly line: string;
  readonly error: string | null;
}

function cleanLine(line: string): string {
  return line.replace(SEPARATOR, '').trim();
}

function formatFailure({line, error}: Failure): string {
  return error === null ? line : `${line} (${error})`;
}

/**
 * Picks the lines that name what failed from a step's output, line by line
 * as it arrives: Vitest's `FAIL` and `×` lines, worker start errors, and the
 * unhandled error and rejection blocks, each with the first error line that
 * follows it (for example "Error: Test timed out in 60000ms."). It keeps at
 * most twenty, each once, so it sees all of the output in bounded memory even
 * when the kept output is cut.
 */
export class FailureScanner {
  private group: string[] = [];
  private linesAfterGroup = 0;
  private readonly failures: Failure[] = [];

  /** Returns what failed in the lines read so far. */
  finish(): string[] {
    this.closeGroup(null);
    return this.failures.map(formatFailure);
  }

  /** Reads the next whole line of output. */
  readLine(rawLine: string): void {
    const line = stripVTControlCharacters(rawLine);
    if (NOTABLE_LINE.test(line)) {
      if (this.linesAfterGroup > 0) this.closeGroup(null);
      if (this.group.length < MAX_FAILURE_LINES) {
        this.group.push(cleanLine(line));
      }
      return;
    }
    if (this.group.length === 0) return;
    this.linesAfterGroup += 1;
    if (ERROR_MESSAGE.test(line)) this.closeGroup(cleanLine(line));
    else if (this.linesAfterGroup >= LOOKAHEAD_LINES) this.closeGroup(null);
  }

  // NOTE(0913vision): Vitest prints tests that failed the same way as
  // consecutive FAIL lines followed by one error, so the error belongs to the
  // whole group of notable lines before it.
  private closeGroup(error: string | null): void {
    for (const line of this.group) this.record({line, error});
    this.group = [];
    this.linesAfterGroup = 0;
  }

  // NOTE(0913vision): A failed test appears first in the summary list without
  // its error and later in the details with it. The later entry takes the
  // earlier one's place, so each test is listed once, with its error.
  private record(failure: Failure): void {
    const withoutError = this.failures.findIndex(
      known => known.line === failure.line && known.error === null,
    );
    if (failure.error !== null && withoutError !== -1) {
      this.failures[withoutError] = failure;
      return;
    }
    const seen = this.failures.some(
      known =>
        known.line === failure.line &&
        (failure.error === null || known.error === failure.error),
    );
    if (!seen && this.failures.length < MAX_FAILURE_LINES) {
      this.failures.push(failure);
    }
  }
}
