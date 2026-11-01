import {describe, expect, it} from 'vitest';
import {adjacentVerseRange} from '@core/bible/adjacentVerses';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';

async function passage(input: string) {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid adjacent-verse fixture');
  return reply.result.value;
}

describe('adjacentVerseRange', () => {
  it('extends canonical range endpoints past omitted text and whole-chapter references', async () => {
    const reply = await formLookupReply(lookupRequest('요한복음 3'));
    if (!reply.result.ok || !reply.bounds) {
      throw Error('Invalid whole chapter fixture');
    }
    expect(
      adjacentVerseRange(reply.result.value, reply.bounds, 'previous'),
    ).toBe('요한복음 2:8-3:36');
    expect(adjacentVerseRange(reply.result.value, reply.bounds, 'next')).toBe(
      '요한복음 3:1-4:1',
    );
    const range = await passage('요한복음 3:16-18');
    const omitted = {...range, verses: range.verses.slice(1, 2)};
    expect(adjacentVerseRange(omitted, reply.bounds, 'previous')).toBe(
      '요한복음 3:15-18',
    );
    expect(adjacentVerseRange(omitted, reply.bounds, 'next')).toBe(
      '요한복음 3:16-19',
    );
    expect(
      adjacentVerseRange(range, {...reply.bounds, bookId: 1}, 'next'),
    ).toBeNull();
  });
});
