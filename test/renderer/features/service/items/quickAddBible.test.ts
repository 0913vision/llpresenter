import * as v from 'valibot';
import {describe, expect, it, vi} from 'vitest';
import {translationIdSchema} from '@core/schema/ids';
import {
  passageItem,
  passageItemWithParts,
} from '@renderer/features/service/items/quickAddBible';
import {isItemOfKind} from '@core/schema/service';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {entryFor} from '@core/bible/split/splitCache';
import * as bibleMeasure from '@renderer/rendering/bibleMeasure';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {createDefaultThemes} from '@core/themes/defaults';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';

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

  it('records defaults for each saved split part before insertion', async () => {
    const canvas = {
      font: '',
      measureText: (text: string) => ({width: text.length * 10}),
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
            verses: [{chapter: 3, verse: 17, text: '처음 다음'}],
          },
        },
        mockLlpApi({
          settings: {
            get: async request => {
              if (request.name === 'themes') {
                return settingsDocument('themes', createDefaultThemes());
              }
              if (request.name === 'screens') {
                return settingsDocument('screens', {
                  screens: [
                    {
                      id: STARTER_SCREEN_IDS.main,
                      name: '청중',
                      kind: 'audience',
                      method: 'fullscreen',
                    },
                  ],
                });
              }
              return settingsDocument('bibleCuts', {
                entries: {
                  [translation]: {
                    '35:3:17': entryFor(
                      '처음 다음',
                      [1],
                      '2026-11-15T00:00:00.000Z',
                    ),
                  },
                },
              });
            },
          },
        }),
      );
      if (result === null || !isItemOfKind(result, 'bible')) {
        throw Error('Missing Bible item');
      }
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
