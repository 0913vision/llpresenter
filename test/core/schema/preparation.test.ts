import {describe, expect, it} from 'vitest';
import {parsePreparation} from '@core/schema/preparation';

describe('parsePreparation', () => {
  it.each([
    {done: 0, total: 0},
    {done: 3, total: 7},
  ])('reads %j', value => {
    expect(parsePreparation(value)).toEqual({ok: true, value});
  });

  it.each([
    null,
    {},
    {done: -1, total: 2},
    {done: 1.5, total: 2},
    {done: 3, total: 2},
    {done: 0, total: 1_000_000},
  ])('refuses %j', value => {
    expect(parsePreparation(value).ok).toBe(false);
  });
});
