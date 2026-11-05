import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {
  BIBLE_CUTS_LIMITS,
  bibleCutsSchema,
  parseBibleCuts,
  serializeBibleCuts,
} from '@core/schema/bibleCuts';
import {expectRoundTrip} from '@fixtures/core/schema/testHelpers';

const entry = {
  hash: '1a2b3c4d',
  cuts: [3, 12],
  confirmedAt: '2026-11-05T00:00:00.000Z',
};
const file = {
  format: 'llsettings.bibleCuts',
  schemaVersion: 1,
  entries: {krv: {'43:3:16': entry}},
};
const accepts = (entries: object) =>
  v.safeParse(bibleCutsSchema, {...file, entries}).success;

describe('saved Bible cut settings', () => {
  it('round-trips translations and nested extensions using the settings file conventions', () => {
    expectRoundTrip(
      {parse: parseBibleCuts, serialize: serializeBibleCuts},
      {
        ...file,
        future: true,
        entries: {
          krv: {'43:3:16': {...entry, future: {kept: true}}},
          kjv: {'1:1:1': {...entry, cuts: []}},
        },
      },
    );
    expect(accepts({})).toBe(true);
  });

  it.each([
    {hash: 'xyz'},
    {hash: '123456789'},
    {hash: undefined},
    {cuts: [0]},
    {cuts: [-1]},
    {cuts: [1.5]},
    {cuts: [3, 3]},
    {cuts: [12, 3]},
    {cuts: [20_001]},
    {cuts: undefined},
    {cuts: null},
    {confirmedAt: 'yesterday'},
    {confirmedAt: undefined},
  ])('rejects an invalid entry %j', patch => {
    expect(accepts({krv: {'43:3:16': {...entry, ...patch}}})).toBe(false);
  });

  it.each([
    '0:1:1',
    '67:1:1',
    '1:151:1',
    '1:1:40001',
    '01:1:1',
    '43:3',
    '../verse',
    '1:1:1.5',
  ])('rejects invalid reference key %s', key => {
    expect(accepts({krv: {[key]: entry}})).toBe(false);
  });

  it('caps translations and cut lists without truncation', () => {
    const translations = Object.fromEntries(
      Array.from({length: BIBLE_CUTS_LIMITS.translations}, (_, i) => [
        `translation-${i}`,
        {},
      ]),
    );
    expect(accepts(translations)).toBe(true);
    expect(accepts({...translations, extra: {}})).toBe(false);
    const cuts = Array.from({length: BIBLE_CUTS_LIMITS.cuts}, (_, i) => i + 1);
    expect(accepts({krv: {'43:3:16': {...entry, cuts}}})).toBe(true);
    expect(
      accepts({krv: {'43:3:16': {...entry, cuts: [...cuts, cuts.length + 1]}}}),
    ).toBe(false);
    expect(accepts({'': {}})).toBe(false);
    expect(accepts({['x'.repeat(257)]: {}})).toBe(false);
  });

  it('caps the total entries across translations', () => {
    const entries = Object.fromEntries(
      Array.from({length: BIBLE_CUTS_LIMITS.entries}, (_, i) => [
        `1:1:${i + 1}`,
        entry,
      ]),
    );
    expect(accepts({krv: entries})).toBe(true);
    expect(accepts({krv: entries, kjv: {'1:1:1': entry}})).toBe(false);
  });
});
