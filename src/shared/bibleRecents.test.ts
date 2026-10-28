import {describe, expect, it} from 'vitest';
import {parseBibleLookupRequest} from './schema/bibleLookup';
import {rememberPassage} from './bibleRecents';

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
