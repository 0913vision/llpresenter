import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {newSlidesItem} from '@core/services/slidesEdits';
import {createServiceItemId} from '@core/schema/ids';
import {
  projectBible,
  type BibleProjection,
} from '@renderer/features/bible/splitProjection';
import {BibleSlidesDialog} from '@renderer/features/bible/BibleSlidesDialog';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {themeElementBase} from '@fixtures/core/themeOutput';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';

const data = vi.hoisted(
  (): {
    projection: BibleProjection | null;
    passage: BibleLookupPassage | null;
  } => ({
    projection: null,
    passage: null,
  }),
);
vi.mock('@renderer/features/bible/loadSlidesProjection', () => ({
  loadSlidesProjection: async () => data.projection,
}));
vi.mock('@renderer/features/bible/useSlidesVerseProjection', () => ({
  useSlidesVerseProjection: () => ({projection: null, failed: true}),
}));
vi.mock('@renderer/features/bible/useBibleTranslation', () => ({
  useBibleTranslation: () => 'sample',
}));
vi.mock('@renderer/features/bible/BiblePassageDialog', () => ({
  BiblePassageDialog: ({
    onChoose,
  }: {
    onChoose: (passage: BibleLookupPassage) => void;
  }) => (
    <button
      onClick={() => {
        if (data.passage !== null) onChoose(data.passage);
      }}
    >
      choose passage
    </button>
  ),
}));

it('runs the same boundary chooser for a preparation insertion before completing it', async () => {
  const passage = {
    ...panelPassage(),
    verses: [{chapter: 3, verse: 16, text: MOCK_LONG_VERSE}],
  };
  const projection = projectBible(
    {
      id: 'prep-chooser',
      kind: 'slides',
      source: 'service',
      verseNumbers: false,
      reference: 'every',
      translationName: false,
      input: [
        {
          label: null,
          labelColor: 'none',
          lines: [],
          verse: {
            reference: {
              translation: passage.translation,
              book: 43,
              chapter: 3,
              verse: 16,
            },
            text: MOCK_LONG_VERSE,
          },
        },
      ],
    },
    {
      element: {...themeElementBase(), kind: 'currentText'},
      layout: mockSplitLayout(),
    },
  );
  if (projection === null) throw Error('Missing projection');
  data.passage = passage;
  data.projection = projection;
  const chooseBoundary = vi.fn(async () => 0);
  const api = mockLlpApi({
    bible: {
      getLlmStatus: async () => ({
        status: 'ready',
        available: true,
        reason: '',
      }),
      chooseBoundary,
    },
  });
  const inserted = vi.fn();
  const closed = vi.fn();
  const view = render(
    <BibleSlidesDialog
      api={api}
      item={newSlidesItem(
        'blank',
        createServiceItemId('00000000-0000-4000-8000-000000000001'),
      )}
      selected={0}
      onInsert={inserted}
      onClose={closed}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: 'choose passage'}));
  await waitFor(() => expect(chooseBoundary).toHaveBeenCalled());
  await waitFor(() => expect(inserted).toHaveBeenCalledOnce());
  expect(closed).toHaveBeenCalledOnce();
  view.unmount();
});
