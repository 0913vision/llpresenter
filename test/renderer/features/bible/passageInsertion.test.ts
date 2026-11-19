import {expect, it, vi} from 'vitest';
import {cutsOfVerse} from '@core/bible/split/splitVerses';
import {saveCuts, entryFor} from '@core/bible/split/splitCache';
import {defaultPreferences} from '@core/schema/preferences';
import {createDefaultThemes} from '@core/themes/defaults';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {installBibleInsertionReview} from '@renderer/features/bible/reviewBibleInsertion';
import {passageItemWithParts} from '@renderer/features/service/items/quickAddBible';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {settingsDocument} from '@fixtures/core/settingsDocument';

vi.mock('@renderer/rendering/bibleMeasure', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/rendering/bibleMeasure')
  >()),
  createBibleMeasureContext: () => ({
    font: '',
    measureText: (text: string) => ({width: text.length * 75}),
  }),
}));

function fixture(autoOpen = true) {
  let saved = settingsDocument('bibleCuts', {entries: {}});
  const themes = settingsDocument('themes', createDefaultThemes());
  const screens = settingsDocument('screens', {
    screens: [
      {
        id: STARTER_SCREEN_IDS.main,
        name: '청중',
        kind: 'audience',
        method: 'fullscreen',
        onDisconnect: 'window',
        alwaysOnTop: false,
        edgeMargin: 0,
        offset: {x: 0, y: 0},
      },
    ],
  });
  const api = mockLlpApi({
    preferences: {
      get: async () => ({
        ...defaultPreferences,
        bible: {...defaultPreferences.bible, splitEditorAutoOpen: autoOpen},
      }),
    },
    settings: {
      get: async ({name}) => {
        if (name === 'bibleCuts') return saved;
        if (name === 'themes') return themes;
        if (name === 'screens') return screens;
        throw Error(`Unexpected settings: ${name}`);
      },
    },
  });
  const passage = {
    ...panelPassage(),
    verses: [
      {
        chapter: 3,
        verse: 16,
        text: [MOCK_LONG_VERSE, MOCK_LONG_VERSE, MOCK_LONG_VERSE].join(' '),
      },
    ],
  };
  const insert = () =>
    passageItemWithParts(
      passage.ref,
      {passage, translation: passage.translation, verseNumbers: true},
      api,
    );
  return {
    insert,
    get cuts() {
      return saved;
    },
    set cuts(next) {
      saved = next;
    },
  };
}

it('stages long verses and rereads their confirmed cuts before returning an item', async () => {
  const proof = fixture();
  let finish: (confirmed: boolean) => void = () => undefined;
  let parts = 0;
  const review = vi.fn<Parameters<typeof installBibleInsertionReview>[0]>(
    (projection, references) => {
      const verse = projection.verses[0];
      const saved = proof.cuts;
      if (verse === undefined || saved.name !== 'bibleCuts') {
        throw Error('Missing verse or settings');
      }
      expect(references).toEqual([verse.reference]);
      const cuts = cutsOfVerse(projection.parts, verse.reference);
      parts = cuts.length + 1;
      const value = saveCuts(
        saved.value,
        verse.reference,
        entryFor(verse.text, cuts, '2026-11-19T00:00:00Z'),
      );
      if (value === null) throw Error('Missing confirmed cuts');
      proof.cuts = {...saved, value, revision: 2};
      return new Promise(resolve => {
        finish = resolve;
      });
    },
  );
  const uninstall = installBibleInsertionReview(review);
  try {
    const inserted = vi.fn<(item: ServiceItem | null) => void>();
    const pending = proof.insert().then(inserted);
    await vi.waitFor(() => expect(review).toHaveBeenCalledOnce());
    expect(inserted).not.toHaveBeenCalled();
    finish(true);
    await pending;
    const item = inserted.mock.calls[0]?.[0];
    if (item == null || !isItemOfKind(item, 'bible')) {
      throw Error('Missing Bible item');
    }
    expect(item.bibleTransitions?.map(transition => transition.part)).toEqual(
      Array.from({length: parts}, (_, index) => index + 1),
    );
  } finally {
    uninstall();
  }
});

it('discards the pending item on Esc and skips review when auto-open is off', async () => {
  const review = vi.fn(async () => false);
  const uninstall = installBibleInsertionReview(review);
  try {
    await expect(fixture().insert()).resolves.toBeNull();
    expect(review).toHaveBeenCalledOnce();
    await expect(fixture(false).insert()).resolves.toMatchObject({
      bible: {split: 'verse'},
    });
    expect(review).toHaveBeenCalledOnce();
  } finally {
    uninstall();
  }
});
