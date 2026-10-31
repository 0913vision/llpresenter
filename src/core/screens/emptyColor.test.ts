import {describe, expect, it} from 'vitest';
import {emptyScreenColor} from './emptyColor';

describe('empty screen color', () => {
  it.each(['fullscreen', 'window', 'ndi'] as const)(
    'defaults %s output to black',
    method => {
      expect(emptyScreenColor({method})).toBe('#000000');
    },
  );
  it('defaults capture output to chroma green', () => {
    expect(emptyScreenColor({method: 'capture'})).toBe('#00B140');
  });
  it.each(['capture', 'fullscreen', 'window', 'ndi'] as const)(
    'keeps a saved color across a change to %s',
    method => {
      expect(emptyScreenColor({method, emptyColor: '#123456'})).toBe('#123456');
    },
  );
});
