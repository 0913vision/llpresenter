import {PassThrough} from 'node:stream';
import {finished} from 'node:stream/promises';
import {describe, expect, it} from 'vitest';
import {readText, TailBuffer} from './step-output.mts';

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
