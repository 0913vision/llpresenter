import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {hymnSchema} from '@core/schema/songs/hymn';

describe('hymnSchema', () => {
  it.each([
    {hymnal: 'new', number: 1},
    {hymnal: 'new', number: 645},
    {hymnal: 'unified', number: 558},
  ])('accepts %j', hymn => {
    expect(v.is(hymnSchema, hymn)).toBe(true);
  });

  it.each([
    {hymnal: 'new', number: 0},
    {hymnal: 'new', number: 646},
    {hymnal: 'unified', number: 559},
    {hymnal: 'new', number: 1.5},
    {hymnal: 'other', number: 1},
    {hymnal: 'new'},
  ])('rejects %j', hymn => {
    expect(v.is(hymnSchema, hymn)).toBe(false);
  });
});
