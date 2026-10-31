import {describe, expect, it} from 'vitest';
import {RECENT_PASSAGE_LIMIT, recentPassages, rememberPassage} from './recents';
import {parsedTranslation} from '@core/bible/testing/testFiles';

const translation = parsedTranslation().id;

describe('recent Bible passages', () => {
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
