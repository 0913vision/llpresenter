import {expect, it} from 'vitest';
import {
  EMPTY_NAME_REASON,
  LONG_NAME_REASON,
  nameReason,
} from '@renderer/ui/fields/nameReason';

it('asks for words, then for a name within its limit, without the spaces around it', () => {
  expect(nameReason('', 4)).toBe(EMPTY_NAME_REASON);
  expect(nameReason('   ', 4)).toBe(EMPTY_NAME_REASON);
  expect(nameReason(' 찬양 ', 2)).toBeUndefined();
  expect(nameReason('찬양대', 2)).toBe(LONG_NAME_REASON);
  expect(nameReason('찬양대 찬양 순서', undefined)).toBeUndefined();
});
