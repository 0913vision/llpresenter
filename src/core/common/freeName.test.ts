import {expect, it} from 'vitest';
import {freeName} from './freeName';

it.each([
  [[], '새 매크로'],
  [['새 매크로'], '새 매크로 2'],
  [['새 매크로', '새 매크로 2', '새 매크로 4'], '새 매크로 3'],
  [['새 매크로 2'], '새 매크로'],
])('picks the first free name among %j', (taken, expected) => {
  expect(freeName('새 매크로', new Set(taken))).toBe(expected);
});
