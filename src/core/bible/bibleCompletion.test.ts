import {describe, expect, it} from 'vitest';
import {bibleBookChoices, completeBibleBook} from './bibleCompletion';

const complete = (input: string, bookId?: number) =>
  completeBibleBook({
    input,
    start: input.length,
    end: input.length,
    bookId,
  });

describe('Bible book completion', () => {
  it.each(['창', '창세', 'ckd', 'Genesis', 'GEN'])(
    'completes %s with a trailing space',
    input => {
      expect(complete(input)).toEqual({input: '창세기 ', caret: 4});
    },
  );
  it('keeps exact matches ahead of partial candidates', () => {
    expect(bibleBookChoices('요').map(b => b.name)).toEqual(['요한복음']);
    expect(complete('요')).toEqual({input: '요한복음 ', caret: 5});
  });
  it('takes the highlighted candidate or the first one when none is pointed', () => {
    expect(complete('왕')?.input).toBe('열왕기상 ');
    expect(complete('왕', 12)?.input).toBe('열왕기하 ');
    expect(complete('요한', 62)?.input).toBe('요한일서 ');
    expect(complete('요한', 999)?.input).toBe('요한복음 ');
  });
  it.each([
    {input: '창 1:1-5', start: 1, end: 1, value: '창세기 1:1-5', caret: 4},
    {input: '1 John 3:2', start: 0, end: 6, value: '요한일서 3:2', caret: 5},
    {
      input: '  창 1장 1절',
      start: 3,
      end: 3,
      value: '  창세기 1장 1절',
      caret: 6,
    },
  ])(
    'preserves the reference suffix in $input',
    ({value, caret, ...request}) => {
      expect(completeBibleBook(request)).toEqual({input: value, caret});
    },
  );
  it('leaves chapter/verse positions and unknown books alone', () => {
    for (const start of [2, 3, 4, 5]) {
      expect(
        completeBibleBook({input: '창 1:1', start, end: start}),
      ).toBeNull();
    }
    for (const input of ['', ' ', 'unknown', '3:16']) {
      expect(complete(input)).toBeNull();
    }
    expect(completeBibleBook({input: '창 1:1', start: 0, end: 3})).toBeNull();
    expect(completeBibleBook({input: '창', start: -1, end: 0})).toBeNull();
  });
  it('drops an expansion that would pass the shared reply limit', () => {
    const input = `요 3:${' '.repeat(250)}16`;
    expect(input).toHaveLength(256);
    expect(bibleBookChoices(input)).toEqual([]);
    expect(completeBibleBook({input, start: 1, end: 1})).toBeNull();
    expect(bibleBookChoices('서')).toHaveLength(8);
  });
});
