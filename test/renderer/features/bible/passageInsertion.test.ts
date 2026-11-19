import {act, render, screen, waitFor} from '@testing-library/react';
import {createElement} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cutsOfVerse} from '@core/bible/split/splitVerses';
import {entryFor} from '@core/bible/split/splitCache';
import type {BibleCutEntry} from '@core/schema/bibleCuts';
import {defaultPreferences} from '@core/schema/preferences';
import {createDefaultThemes} from '@core/themes/defaults';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {installBibleInsertionReview} from '@renderer/features/bible/reviewBibleInsertion';
import {BibleInsertionReview} from '@renderer/features/bible/BibleInsertionReview';
import {passageItemWithParts} from '@renderer/features/service/items/quickAddBible';
import {useShow} from '@renderer/session/showStore';
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

const serviceId = '00000000-0000-4000-8000-000000000801';
const otherServiceId = '00000000-0000-4000-8000-000000000802';

beforeEach(() => {
  useShow.setState({serviceId, serviceEpoch: 1});
});

afterEach(() => {
  useShow.setState({serviceId: null, serviceEpoch: 0});
  delete window.llp;
});

function fixture(autoOpen = true) {
  const passage = {
    ...panelPassage(),
    verses: [
      {
        chapter: 3,
        verse: 16,
        text: [MOCK_LONG_VERSE, MOCK_LONG_VERSE, MOCK_LONG_VERSE].join(' '),
      },
      {chapter: 3, verse: 17, text: '가 나'},
      {chapter: 3, verse: 18, text: '다 라'},
    ],
  };
  const initial = entryFor('가 나', [], '2026-11-19T00:00:00Z');
  const settings = (entries: Record<string, BibleCutEntry>, revision: number) =>
    settingsDocument(
      'bibleCuts',
      {entries: {[passage.translation]: entries}},
      revision,
    );
  let saved = settings({'43:3:17': initial}, 1);
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
  const insert = () =>
    passageItemWithParts(
      passage.ref,
      {passage, translation: passage.translation, verseNumbers: true},
      {api, serviceId},
    );
  return {
    api,
    insert,
    initial,
    changeSharedCuts(entries: Record<string, BibleCutEntry>) {
      saved = settings(entries, saved.revision + 1);
    },
  };
}

it('merges this review’s confirmations into the initial snapshot despite concurrent changes', async () => {
  const proof = fixture();
  const read = vi.spyOn(proof.api.settings, 'get');
  let finish: () => void = () => undefined;
  let confirmed: BibleCutEntry | undefined;
  const review = vi.fn<Parameters<typeof installBibleInsertionReview>[0]>(
    ({serviceId: origin, projection, references}) => {
      const verse = projection.verses[0];
      if (verse === undefined) throw Error('Missing verse');
      expect(origin).toBe(serviceId);
      expect(references).toEqual([verse.reference]);
      const cuts = cutsOfVerse(projection.parts, verse.reference);
      const entry = entryFor(verse.text, cuts, '2026-11-19T01:00:00Z');
      confirmed = entry;
      proof.changeSharedCuts({
        '43:3:16': entryFor(verse.text, [1], '2026-11-19T02:00:00Z'),
        '43:3:17': entryFor('가 나', [1], '2026-11-19T02:00:00Z'),
        '43:3:18': entryFor('다 라', [1], '2026-11-19T02:00:00Z'),
      });
      return new Promise(resolve => {
        finish = () => resolve({'43:3:16': entry});
      });
    },
  );
  const uninstall = installBibleInsertionReview(review);
  try {
    const inserted =
      vi.fn<(result: Awaited<ReturnType<typeof proof.insert>>) => void>();
    const pending = proof.insert().then(inserted);
    await vi.waitFor(() => expect(review).toHaveBeenCalledOnce());
    expect(inserted).not.toHaveBeenCalled();
    finish();
    await pending;
    const result = inserted.mock.calls[0]?.[0];
    const item: ServiceItem | null = result?.ok ? result.value : null;
    if (item == null || !isItemOfKind(item, 'bible')) {
      throw Error('Missing Bible item');
    }
    expect(item.bible.cuts).toEqual({
      '43:3:16': confirmed,
      '43:3:17': proof.initial,
    });
    expect(
      item.bibleTransitions?.filter(
        transition => transition.verse.verse === 16,
      ),
    ).toHaveLength((confirmed?.cuts.length ?? 0) + 1);
    expect(
      read.mock.calls.filter(([request]) => request.name === 'bibleCuts'),
    ).toHaveLength(1);
  } finally {
    uninstall();
  }
});

it('discards the pending item on Esc and skips review when auto-open is off', async () => {
  const review = vi.fn(async () => null);
  const uninstall = installBibleInsertionReview(review);
  try {
    await expect(fixture().insert()).resolves.toEqual({ok: true, value: null});
    expect(review).toHaveBeenCalledOnce();
    await expect(fixture(false).insert()).resolves.toMatchObject({
      ok: true,
      value: {bible: {split: 'verse'}},
    });
    expect(review).toHaveBeenCalledOnce();
  } finally {
    uninstall();
  }
});

it('cancels a passage when the service changes while measurement settings are pending', async () => {
  const proof = fixture();
  window.llp = proof.api;
  const host = render(createElement(BibleInsertionReview));
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const get = proof.api.settings.get;
  const delayed = vi
    .spyOn(proof.api.settings, 'get')
    .mockImplementation(async request => {
      await held;
      return get(request);
    });
  const llm = vi.spyOn(proof.api.bible, 'getLlmStatus');
  try {
    const complete =
      vi.fn<(result: Awaited<ReturnType<typeof proof.insert>>) => void>();
    const pending = proof.insert().then(complete);
    expect(delayed).toHaveBeenCalled();
    act(() => {
      useShow.setState({serviceId: otherServiceId, serviceEpoch: 2});
    });
    await act(async () => release());
    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith({ok: true, value: null}),
    );
    await pending;
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(llm).not.toHaveBeenCalled();
  } finally {
    release();
    host.unmount();
  }
});
