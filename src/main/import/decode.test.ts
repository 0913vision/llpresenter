import {describe, expect, it} from 'vitest';
import {convertTextImport} from './convert';
import {decodeTextImport} from './decode';
import {
  encodedTextSamples,
  testText as text,
  cp949Sample as cp949,
} from './testText';

describe('text import encoding', () => {
  it.each(encodedTextSamples)(
    'gives the same draft from %s',
    (_name, bytes) => {
      const decoded = decodeTextImport(bytes, 'auto');
      expect(decoded).toEqual({ok: true, value: text});
      if (!decoded.ok) throw new Error('Expected decoded text');
      expect(
        convertTextImport({
          source: {
            source: 'file',
            fileName: 'Example.txt',
            text: decoded.value,
          },
          options: {
            split: 'lineBreak',
            unitsPerSlide: 2,
            labels: 'bracketLine',
            firstLine: 'lyrics',
          },
        }),
      ).toEqual({
        ok: true,
        value: {
          title: 'Example',
          slides: [
            {lines: ['첫째 문장', '뷁 새 문장'], section: 0},
            {label: '후렴', lines: ['마지막 문장'], section: 1},
          ],
        },
      });
    },
  );

  it('honors explicit encoding and does not fall back from malformed forced UTF-8', () => {
    expect(decodeTextImport(cp949, 'cp949')).toEqual({ok: true, value: text});
    expect(decodeTextImport(Buffer.from(text), 'utf-8')).toEqual({
      ok: true,
      value: text,
    });
    expect(decodeTextImport(cp949, 'utf-8')).toMatchObject({
      ok: false,
      error: {reason: 'decode-failed'},
    });
  });

  it.each(
    [
      [0x81],
      [0xff],
      [0xff, 0xfe, 0x00],
      [0xfe, 0xff, 0xd8, 0x00],
      [0xef, 0xbb, 0xbf, 0xff],
    ].map(bytes => ({bytes: Uint8Array.from(bytes)})),
  )('refuses invalid or truncated bytes $bytes', ({bytes}) => {
    expect(decodeTextImport(bytes, 'auto')).toMatchObject({
      ok: false,
      error: {reason: 'decode-failed'},
    });
  });

  it('rejects replacement output from CP949 instead of returning corrupted lyrics', () => {
    expect(decodeTextImport(Uint8Array.from([0x81]), 'cp949')).toMatchObject({
      ok: false,
      error: {reason: 'decode-failed'},
    });
  });

  it('rejects replacement characters already present in Unicode without retrying CP949', () => {
    expect(decodeTextImport(Buffer.from('One\uFFFD'), 'auto')).toMatchObject({
      ok: false,
      error: {reason: 'decode-failed'},
    });
    expect(
      decodeTextImport(
        Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from('One\uFFFD', 'utf16le'),
        ]),
        'auto',
      ),
    ).toMatchObject({ok: false, error: {reason: 'decode-failed'}});
  });
});
