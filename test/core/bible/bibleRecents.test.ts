import {describe, expect, it} from 'vitest';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {
  RECENT_PASSAGE_LIMIT,
  recentPassages,
  rememberPassage,
} from '@core/bible/bibleRecents';
import {parsedTranslation} from '@fixtures/core/bible/testFiles';

describe('Bible recent history', () => {
  it('promotes an existing entry without copying an oversized history', () => {
    const parsed = parseBibleLookupRequest({
      input: '요 3:1',
      translation: 'sample',
    });
    if (!parsed.ok) throw new Error('Invalid recent fixture');
    const history = Array.from({length: 1000}, (_, index) => ({
      ref: `요한복음 3:${index + 1}`,
      translation: parsed.value.translation,
      extension: {kept: index},
    }));
    const first = history[0];
    if (!first) throw new Error('Missing recent fixture');
    const iterator = history[Symbol.iterator].bind(history);
    let visited = 0;
    history[Symbol.iterator] = function* (): Generator<
      (typeof history)[number],
      undefined
    > {
      for (const item of iterator()) {
        visited++;
        yield item;
      }
      return undefined;
    };
    const result = rememberPassage(history, first);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual(first);
    expect(result.map(item => item.ref)).toEqual(
      Array.from({length: 10}, (_, index) => `요한복음 3:${index + 1}`),
    );
    expect(visited).toBeLessThanOrEqual(11);
  });
});

const translation = parsedTranslation().id;

describe('recent Bible passages', () => {
  it('preserves stored range strings when reading and saving other passages', () => {
    const old = {ref: 'John 3:16-18', translation};
    const fresh = {ref: 'John 3:19', translation};
    expect(recentPassages([old])).toEqual([old]);
    expect(rememberPassage([old], fresh)).toEqual([fresh, old]);
  });

  it('bounds and deduplicates stored history before a passage is shown', () => {
    const previous = Array.from({length: 15}, (_, index) => ({
      ref: `요한복음 3:${index + 1}`,
      translation,
    }));
    expect(
      recentPassages([
        previous[0] ?? {ref: '요한복음 3:1', translation},
        ...previous,
      ]),
    ).toEqual(previous.slice(0, RECENT_PASSAGE_LIMIT));
    expect(recentPassages([])).toEqual([]);
    expect(previous).toHaveLength(15);
  });
  it('moves a duplicate to the front, preserves unknown fields, and caps the list', () => {
    const previous = Array.from({length: 15}, (_, index) => ({
      ref: `요한복음 3:${index + 1}`,
      translation,
      custom: index,
    }));
    const passage = {ref: '요한복음 3:5', translation};
    const result = rememberPassage(previous, passage);
    expect(result).toHaveLength(RECENT_PASSAGE_LIMIT);
    expect(result[0]).toEqual({...passage, custom: 4});
    expect(result.filter(item => item.ref === passage.ref)).toHaveLength(1);
    expect(result[1]).toEqual(previous[0]);
    expect(previous).toHaveLength(15);
  });

  it('distinguishes translations and deduplicates earlier entries without mutating them', () => {
    const other = parsedTranslation({...parsedTranslation(), id: 'other'}).id;
    const first = {ref: '요한복음 3:16', translation};
    const previous = [first, {...first}, {...first, translation: other}];
    const result = rememberPassage(previous, {...first, translation: other});
    expect(result).toEqual([{...first, translation: other}, first]);
    expect(previous).toHaveLength(3);
    expect(rememberPassage([], first)).toEqual([first]);
  });
});
