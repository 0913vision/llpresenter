import * as v from 'valibot';
import {describe, expect, it, vi} from 'vitest';
import {translationIdSchema} from '@core/schema/ids';
import {
  passageItem,
  passageItemWithParts,
} from '@renderer/features/service/items/quickAddBible';
import {isItemOfKind} from '@core/schema/service';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import * as bibleMeasure from '@renderer/rendering/bibleMeasure';

const translation = v.parse(translationIdSchema, 'krv');

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

  it('takes reference and translation settings but ignores legacy packing defaults', () => {
    expect(
      passageItem('요한복음 3:16', {
        translation,
        verseNumbers: true,
        split: 'two',
        reference: 'last',
        translationName: true,
      }),
    ).toMatchObject({
      bible: {split: 'verse', reference: 'last', translationName: true},
    });
  });

  it('writes a new passage transition for each known verse', () => {
    const transition = {kind: 'push', dir: 'right', sec: 2} as const;
    const result = passageItem('요한복음 3:16~17', {
      translation,
      verseNumbers: true,
      transition,
      passage: {
        translation,
        ref: '요한복음 3:16~17',
        displayRef: '요한복음 3:16~17',
        verses: [
          {chapter: 3, verse: 16, text: 'one'},
          {chapter: 3, verse: 17, text: 'two'},
        ],
      },
    });
    if (!isItemOfKind(result, 'bible')) throw Error('Missing Bible item');
    expect(result.bibleTransitions).toMatchObject([
      {
        verse: {translation, book: 43, chapter: 3, verse: 16},
        part: 1,
        transition,
      },
      {
        verse: {translation, book: 43, chapter: 3, verse: 17},
        part: 1,
        transition,
      },
    ]);
  });

  it('records defaults for each measured split part before insertion', async () => {
    const canvas = {
      font: '',
      measureText: (text: string) => ({width: text.length * 80}),
    };
    const getContext = vi
      .spyOn(bibleMeasure, 'createBibleMeasureContext')
      .mockReturnValue(canvas);
    try {
      const transition = {kind: 'wipe', dir: 'left', sec: 0.7} as const;
      const result = await passageItemWithParts(
        '하박국 3:17',
        {
          translation,
          verseNumbers: true,
          transition,
          passage: {
            translation,
            ref: '하박국 3:17',
            displayRef: '하박국 3:17',
            verses: [{chapter: 3, verse: 17, text: MOCK_LONG_VERSE}],
          },
        },
        mockLlpApi(),
      );
      if (!isItemOfKind(result, 'bible')) throw Error('Missing Bible item');
      expect(result.bibleTransitions?.length ?? 0).toBeGreaterThan(1);
      expect(result.bibleTransitions?.map(entry => entry.part)).toEqual(
        result.bibleTransitions?.map((_, index) => index + 1),
      );
      expect(
        result.bibleTransitions?.every(
          entry => entry.transition === transition,
        ),
      ).toBe(true);
    } finally {
      getContext.mockRestore();
    }
  });
});
