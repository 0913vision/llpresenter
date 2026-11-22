import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import type {BibleCutSelection} from '@core/schema/bibleCuts';
import {splitPassage} from '@core/bible/split/splitPassage';
import {entryFor} from '@core/bible/split/splitCache';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {splitVerseParts, type VerseInput} from '@core/bible/split/splitVerses';
import {SplitReview} from '@renderer/features/bible/SplitReview';
import type {BibleSplit} from '@renderer/features/bible/passageSplitter';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {mockSplitLayout} from '@fixtures/core/bibleSplit';
import {builtIn} from '@fixtures/core/themeOutput';

vi.mock('@renderer/features/bible/SplitSlidePicture', () => ({
  SplitSlidePicture: () => null,
}));

it('confirms the fitting rule-based parts when a word cannot fit', async () => {
  const text = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하';
  const layout = mockSplitLayout(10, 1);
  const projection: BibleSplit = {
    ...splitPassage(
      {...panelPassage(), verses: [{chapter: 3, verse: 16, text}]},
      {layout, verseNumbers: false},
    ),
    theme: builtIn(BUILT_IN_THEME_IDS.scripture),
    address: '요한복음 3:16',
  };
  const verse = projection.verses[0];
  if (!verse) throw Error('Expected fitting rule-based parts');
  expect(projection.parts.length).toBeGreaterThan(1);

  const confirm = vi.fn<
    (
      verse: VerseInput,
      cut: {
        readonly selection: BibleCutSelection;
        readonly texts: readonly string[];
      },
    ) => Promise<void>
  >(async () => undefined);
  const complete = vi.fn();
  render(
    <SplitReview
      projection={projection}
      references={[verse.reference]}
      pending={new Set()}
      onConfirm={confirm}
      onComplete={complete}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText('규칙 기반 분할')).toBeDefined();
  expect(screen.getAllByRole('img')).toHaveLength(projection.parts.length);
  fireEvent.click(screen.getByRole('button', {name: '확정'}));
  await waitFor(() => expect(complete).toHaveBeenCalledOnce());
  const choice = confirm.mock.calls[0]?.[1].selection;
  if (choice === undefined) throw Error('Expected confirmed offsets');
  expect(choice.unit).toBe('character');
  const saved = entryFor(text, choice, '2026-11-20T00:00:00Z');
  expect(splitVerseParts(verse, layout, {confirmed: saved})).toEqual(
    projection.parts.map(part => ({...part, manual: true})),
  );
});
