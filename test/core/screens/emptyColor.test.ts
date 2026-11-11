import {describe, expect, it} from 'vitest';
import {emptyScreenColor} from '@core/screens/emptyColor';

describe('empty screen color', () => {
  it.each(['fullscreen', 'window'] as const)(
    'defaults %s output to black',
    method => {
      expect(emptyScreenColor({method})).toBe('#000000');
    },
  );
  it.each(['capture', 'ndi'] as const)(
    'defaults %s fallback to chroma green',
    method => {
      expect(emptyScreenColor({method})).toBe('#00B140');
    },
  );
  it.each(['capture', 'fullscreen', 'window', 'ndi'] as const)(
    'keeps a saved color across a change to %s',
    method => {
      expect(emptyScreenColor({method, emptyColor: '#123456'})).toBe('#123456');
    },
  );
});
