import {expect, it, onTestFinished, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleAiState} from '@core/schema/bible/bibleAi';
import {splitPassage} from '@core/slides/splitPassage';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  BibleRefinementRun,
  BibleRefinements,
} from '@renderer/features/bible/split/BibleRefinements';
import type {BibleSplit} from '@renderer/features/bible/passageSplitter';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {MOCK_LONG_VERSE, mockSplitLayout} from '@fixtures/core/bibleSplit';
import {builtIn} from '@fixtures/core/themeOutput';

const TEXT = MOCK_LONG_VERSE;
const READY: BibleAiState = {status: 'ready', available: true, reason: ''};

function projection(): BibleSplit {
  return {
    ...splitPassage(
      {
        ...panelPassage(),
        verses: [
          {chapter: 1, verse: 1, text: TEXT},
          {chapter: 1, verse: 2, text: TEXT},
        ],
      },
      {layout: mockSplitLayout(), verseNumbers: false},
    ),
    theme: builtIn(BUILT_IN_THEME_IDS.scripture),
    address: '창세기 1:1-2',
  };
}

function bibleApi({
  status = async () => READY,
  choose = async () => 0,
}: {
  readonly status?: () => Promise<BibleAiState>;
  readonly choose?: LlpApi['bible']['chooseBoundary'];
} = {}) {
  const chooseBoundary = vi.fn(choose);
  const cancelBoundary = vi.fn(async () => true);
  const api = mockLlpApi({
    bible: {
      getLlmStatus: status,
      chooseBoundary,
      cancelBoundary,
    },
  }).bible;
  return {api, chooseBoundary, cancelBoundary};
}

/** Every verse of a split, to refine whether or not the rules are sure. */
function all(split: BibleSplit) {
  return {references: split.verses.map(verse => verse.reference)};
}

function progressOf(run: BibleRefinementRun): number[] {
  const sizes: number[] = [];
  run.subscribe(() => sizes.push(run.getSnapshot().pending.size));
  return sizes;
}

it('refines each verse in order, keeps the cuts that fit, and shows the verses still waiting', async () => {
  const split = projection();
  const {api, chooseBoundary} = bibleApi();
  const run = new BibleRefinementRun(api, split);
  const sizes = progressOf(run);
  await run.start(all(split));
  const [first, second] = split.verses;
  if (first === undefined || second === undefined) throw new Error('verses');
  expect(run.suggestCuts(first, '')).toBeDefined();
  expect(run.suggestCuts(second, '')).toBeDefined();
  expect(chooseBoundary).toHaveBeenCalled();
  expect(sizes).toEqual([0, 2, 1, 0]);
  expect(run.getSnapshot()).toEqual({initialized: true, pending: new Set()});
});

it('asks nothing again for verses it has refined already', async () => {
  const split = projection();
  const cache = new BibleRefinements();
  const first = bibleApi();
  await new BibleRefinementRun(first.api, split, cache).start(all(split));
  const again = bibleApi();
  await new BibleRefinementRun(again.api, split, cache).start(all(split));
  expect(again.chooseBoundary).not.toHaveBeenCalled();
});

it('refines nothing when the Bible AI is not running or its state can not be read', async () => {
  const stopped = bibleApi({
    status: async () => ({status: 'stopped', available: false, reason: ''}),
  });
  const split = projection();
  const run = new BibleRefinementRun(stopped.api, split);
  await run.start(all(split));
  expect(stopped.chooseBoundary).not.toHaveBeenCalled();
  expect(run.getSnapshot()).toEqual({initialized: true, pending: new Set()});

  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => error.mockRestore());
  const unread = bibleApi({
    status: () => Promise.reject(new Error('gone')),
  });
  await new BibleRefinementRun(unread.api, split).start(all(split));
  expect(unread.chooseBoundary).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(
    'Could not read Bible AI status',
    expect.any(Error),
  );
});

it('drops its suggestions and stops the lookup in main when it is cancelled', async () => {
  const split = projection();
  let asked: () => void = () => undefined;
  const asking = new Promise<void>(resolve => {
    asked = resolve;
  });
  // NOTE(0913vision): Like main, a cancelled lookup ends the question it
  // waits on.
  let endQuestion: (error: Error) => void = () => undefined;
  const {api, cancelBoundary} = bibleApi({
    choose: () => {
      asked();
      return new Promise((_resolve, reject) => {
        endQuestion = reject;
      });
    },
  });
  cancelBoundary.mockImplementation(async () => {
    endQuestion(new Error('Bible lookup cancelled'));
    return true;
  });
  const run = new BibleRefinementRun(api, split);
  const started = run.start(all(split));
  await asking;
  run.cancel();
  await started;
  expect(cancelBoundary).toHaveBeenCalledOnce();
  expect(run.getSnapshot().pending.size).toBe(0);
  const [first] = split.verses;
  if (first === undefined) throw new Error('verses');
  expect(run.suggestCuts(first, '')).toBeUndefined();
});

it('keeps at most 256 suggestions, letting the oldest go first', () => {
  const cache = new BibleRefinements();
  const layout = mockSplitLayout();
  const [first] = projection().verses;
  if (first === undefined) throw new Error('verses');
  const verse = (index: number) => ({...first, text: `구절 ${index}`});
  for (let index = 0; index < 257; index++) {
    cache.put(verse(index), layout, {prefix: '', cuts: [index]});
  }
  expect(cache.get(verse(0), layout, '')).toBeUndefined();
  expect(cache.get(verse(1), layout, '')).toEqual([1]);
  expect(cache.get(verse(256), layout, '')).toEqual([256]);
});
