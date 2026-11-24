import {describe, expect, it} from 'vitest';
import {defaultColumns, sizeClassFor} from '@renderer/ui/panels/sizeClass';

describe('sizeClassFor', () => {
  it('switches classes at the boundaries', () => {
    expect(sizeClassFor(1280)).toBe('narrow');
    expect(sizeClassFor(1536)).toBe('narrow');
    expect(sizeClassFor(1599)).toBe('narrow');
    expect(sizeClassFor(1600)).toBe('normal');
    expect(sizeClassFor(1920)).toBe('normal');
    expect(sizeClassFor(2399)).toBe('normal');
    expect(sizeClassFor(2400)).toBe('wide');
    expect(sizeClassFor(2560)).toBe('wide');
  });
});

it('keeps the wide preview column near one quarter of a 2560px window', () => {
  expect(defaultColumns.wide.right).toBe(640);
});
