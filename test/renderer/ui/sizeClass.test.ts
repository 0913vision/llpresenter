import {describe, expect, it} from 'vitest';
import {sizeClassFor} from '@renderer/ui/sizeClass';

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
