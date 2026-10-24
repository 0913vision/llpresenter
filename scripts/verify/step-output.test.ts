import {PassThrough} from 'node:stream';
import {finished} from 'node:stream/promises';
import {describe, expect, it} from 'vitest';
import {
  LineSplitter,
  readText,
  StepCapture,
  TailBuffer,
} from './step-output.mts';

describe('readText', () => {
  it('keeps a character whole when it is split across two chunks', async () => {
    const stream = new PassThrough();
    const texts: string[] = [];
    readText(stream, text => texts.push(text));
    const cross = Buffer.from('× done', 'utf8');
    stream.write(cross.subarray(0, 1));
    stream.write(cross.subarray(1));
    stream.end();
    await finished(stream);
    expect(texts.join('')).toBe('× done');
  });
});

describe('TailBuffer', () => {
  it('returns everything while it fits', () => {
    const buffer = new TailBuffer(10);
    buffer.push('abc');
    buffer.push('def');
    expect(buffer.text()).toBe('abcdef');
  });

  it('keeps the last characters and counts the ones it dropped', () => {
    const buffer = new TailBuffer(10);
    for (const piece of ['aaaaaa', 'bbbbbb', 'cccccc']) buffer.push(piece);
    expect(buffer.text()).toBe(
      '[verify dropped the first 8 characters of this output]\nbbbbcccccc',
    );
  });

  it('cuts a single piece that is longer than the limit', () => {
    const buffer = new TailBuffer(4);
    buffer.push('0123456789');
    expect(buffer.text()).toBe(
      '[verify dropped the first 6 characters of this output]\n6789',
    );
  });
});

describe('LineSplitter', () => {
  function splitPieces(pieces: readonly string[]): string[] {
    const splitter = new LineSplitter();
    const lines: string[] = [];
    const onLine = (line: string): void => {
      lines.push(line);
    };
    for (const piece of pieces) splitter.push(piece, onLine);
    splitter.flush(onLine);
    return lines;
  }

  it('holds an unfinished line until the rest arrives', () => {
    expect(splitPieces(['one\ntw', 'o\nthr', 'ee'])).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('splits a line break that arrives in two pieces once', () => {
    expect(splitPieces(['one\r', '\ntwo\r\n'])).toEqual(['one', 'two']);
  });

  it('reads only the start of a very long line', () => {
    const [line] = splitPieces(['y'.repeat(3000), 'y'.repeat(3000), '\n']);
    expect(line).toHaveLength(4096);
  });
});

describe('StepCapture', () => {
  it('keeps the unfinished line of each stream apart', () => {
    const capture = new StepCapture(1000);
    capture.stdout('building 50%');
    capture.stderr(' FAIL  |node| a.test.ts > adds\n');
    capture.stderr('Error: expected 1 to be 2\n');
    capture.stdout(' done\n');
    expect(capture.finish().failureLines).toEqual([
      'FAIL  |node| a.test.ts > adds (Error: expected 1 to be 2)',
    ]);
  });

  it("keeps verify's own lines in the output but not in what failed", () => {
    const capture = new StepCapture(1000);
    capture.stdout('ok\n');
    capture.note('[verify stopped step FAIL x]');
    const captured = capture.finish();
    expect(captured.output).toBe('ok\n\n[verify stopped step FAIL x]\n');
    expect(captured.failureLines).toEqual([]);
  });

  it('finds an early failure when the kept output is cut', () => {
    const capture = new StepCapture(100);
    capture.stdout(' FAIL  |node| a.test.ts > early\nError: early failure\n');
    for (let i = 0; i < 100; i += 1) capture.stdout(`${'x'.repeat(99)}\n`);
    const captured = capture.finish();
    expect(captured.failureLines).toEqual([
      'FAIL  |node| a.test.ts > early (Error: early failure)',
    ]);
    expect(captured.output).toMatch(/^\[verify dropped the first \d+ /);
  });
});
