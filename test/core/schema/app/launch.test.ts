import {describe, expect, it} from 'vitest';
import {parsePreparation} from '@core/schema/app/launch';

describe('parsePreparation', () => {
  it.each([
    {task: 'data', done: 0, total: 1, ended: false},
    {task: 'pictures', done: 7, total: 7, ended: true},
  ])('reads %j', value => {
    expect(parsePreparation(value)).toEqual({ok: true, value});
  });

  it.each([
    null,
    {},
    {task: 'files', done: 0, total: 1, ended: false},
    {task: 'data', done: -1, total: 2, ended: false},
    {task: 'data', done: 1.5, total: 2, ended: false},
    {task: 'data', done: 3, total: 2, ended: false},
    {task: 'data', done: 0, total: 1_000_000, ended: false},
    {task: 'data', done: 0, total: 1},
  ])('refuses %j', value => {
    expect(parsePreparation(value).ok).toBe(false);
  });
});
