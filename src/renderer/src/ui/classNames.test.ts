import {describe, expect, it} from 'vitest';
import {classNames} from './classNames';

describe('classNames', () => {
  it('joins the names that are set and skips the rest', () => {
    expect(classNames('a', false, undefined, '', 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is set', () => {
    expect(classNames(false, undefined)).toBe('');
  });
});
