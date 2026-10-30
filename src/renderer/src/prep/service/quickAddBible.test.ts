import * as v from 'valibot';
import {describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {translationIdSchema} from '@core/schema/ids';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {bibleEntries, passageItem} from './quickAddBible';

const translation = v.parse(translationIdSchema, 'krv');

function reply(overrides: Partial<BibleLookupReply> = {}): BibleLookupReply {
  return {
    input: '요 3:16',
    translation,
    suggestions: [],
    result: {
      ok: true,
      value: {
        translation,
        ref: '요한복음 3:16',
        displayRef: '요한복음 3:16',
        verses: [{chapter: 3, verse: 16, text: '하나님이 세상을'}],
      },
    },
    ...overrides,
  };
}

function items(entries: readonly MenuEntry[]): readonly MenuItem[] {
  return entries.filter((entry): entry is MenuItem => entry.kind === 'item');
}

describe('quick add Bible passages', () => {
  it('makes a passage item with the default settings and a new id', () => {
    const first = passageItem('요한복음 3:16', {
      translation,
      verseNumbers: true,
    });
    const second = passageItem('요한복음 3:16', {
      translation,
      verseNumbers: false,
    });
    expect(first).toMatchObject({
      bible: {
        translation,
        ref: '요한복음 3:16',
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    });
    expect(second).toMatchObject({bible: {verseNumbers: false}});
    expect(first.id).not.toBe(second.id);
  });

  it('lists nothing before an answer and the typed passage first when it is valid', () => {
    expect(bibleEntries(null, () => undefined)).toEqual([]);
    const onInsert = vi.fn();
    const entries = bibleEntries(
      reply({
        suggestions: [
          {
            bookId: 43,
            name: '요한복음',
            input: '요한복음 3:16',
            resolved: {ref: '요한복음 3:16', verseCount: 1},
          },
          {
            bookId: 62,
            name: '요한일서',
            input: '요한일서',
            resolved: {ref: '요한일서 1:1-10', verseCount: 10},
          },
          {bookId: 44, name: '사도행전', input: '사도행전'},
        ],
      }),
      onInsert,
    );
    expect(items(entries).map(item => [item.label, item.meta])).toEqual([
      ['요한복음 3:16', '절 1개'],
      ['요한일서', '절 10개'],
    ]);
    items(entries).forEach(item => item.onSelect?.());
    expect(onInsert.mock.calls).toEqual([
      ['요한복음 3:16'],
      ['요한일서 1:1-10'],
    ]);
  });

  it('offers only the books that resolve while the typed text is not a passage', () => {
    const entries = bibleEntries(
      reply({
        result: {ok: false, error: {code: 'syntax', message: '참조 형식'}},
        suggestions: [
          {
            bookId: 43,
            name: '요한복음',
            input: '요한복음',
            resolved: {ref: '요한복음 1:1-51', verseCount: 51},
          },
        ],
      }),
      () => undefined,
    );
    expect(items(entries).map(item => item.label)).toEqual(['요한복음']);
  });
});
