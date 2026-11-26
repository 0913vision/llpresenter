import {renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {splitPassage} from '@core/slides/splitPassage';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import type {BibleSplit} from '@renderer/features/bible/passageSplitter';
import {useBibleRefinement} from '@renderer/features/bible/split/useBibleRefinement';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {MOCK_LONG_VERSE, mockSplitLayout} from '@fixtures/core/bibleSplit';
import {builtIn} from '@fixtures/core/themeOutput';

const runs = vi.hoisted(() => {
  const progress = {initialized: true};
  const made: Array<{
    readonly split: unknown;
    readonly start: ReturnType<typeof vi.fn>;
    readonly cancel: ReturnType<typeof vi.fn>;
  }> = [];
  return {made, progress};
});
vi.mock('@renderer/features/bible/split/BibleRefinements', () => ({
  BibleRefinementRun: class {
    readonly start = vi.fn(async () => undefined);
    readonly cancel = vi.fn();
    readonly suggestCuts = vi.fn();
    readonly subscribe = () => () => undefined;
    readonly getSnapshot = () => runs.progress;
    constructor(_api: unknown, split: unknown) {
      runs.made.push({split, start: this.start, cancel: this.cancel});
    }
  },
}));

function split(text: string, numbered = false): BibleSplit {
  return {
    ...splitPassage(
      {...panelPassage(), verses: [{chapter: 1, verse: 1, text}]},
      {layout: mockSplitLayout(), verseNumbers: numbered},
    ),
    theme: builtIn(BUILT_IN_THEME_IDS.scripture),
    address: '창세기 1:1',
  };
}

afterEach(() => {
  runs.made.length = 0;
});

it('starts one run for its verses and box, and keeps it while they stay the same', () => {
  const first = split(MOCK_LONG_VERSE);
  const view = renderHook(({value}) => useBibleRefinement(undefined, value), {
    initialProps: {value: first},
  });
  expect(runs.made).toHaveLength(1);
  expect(runs.made[0]?.start).toHaveBeenCalledOnce();
  view.rerender({value: {...first}});
  expect(runs.made).toHaveLength(1);
  expect(view.result.current.initialized).toBe(true);
});

it('cancels the run and starts another when the verses change, and cancels it when it goes', () => {
  const view = renderHook(({value}) => useBibleRefinement(undefined, value), {
    initialProps: {value: split(MOCK_LONG_VERSE)},
  });
  view.rerender({value: split(`${MOCK_LONG_VERSE} 다시`)});
  expect(runs.made).toHaveLength(2);
  expect(runs.made[0]?.cancel).toHaveBeenCalled();
  expect(runs.made[1]?.start).toHaveBeenCalledOnce();
  view.unmount();
  expect(runs.made[1]?.cancel).toHaveBeenCalled();
});
