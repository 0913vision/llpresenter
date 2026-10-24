import {describe, expect, it} from 'vitest';
import {labelColorValue} from './labelColor';

describe('labelColorValue', () => {
  it('points at the label token of the color', () => {
    expect(labelColorValue('teal')).toBe('var(--label-teal)');
    expect(labelColorValue('none')).toBe('var(--label-none)');
  });
});
