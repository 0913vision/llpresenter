import {describe, expect, it, vi} from 'vitest';
import {
  BibleRefinements,
  BibleRefinementRun,
  verseKey,
} from '@renderer/features/bible/BibleRefinements';
import {
  projectBible,
  type BibleProjection,
} from '@renderer/features/bible/splitProjection';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import type {BibleAiRequest} from '@core/schema/bibleAi';

function setup() {
  const layout = mockSplitLayout();
  const element = {...themeElementBase(), kind: 'currentText' as const};
  const passage = {
    ...panelPassage(),
    verses: [16, 17, 18].map(verse => ({
      chapter: 3,
      verse,
      text: MOCK_LONG_VERSE.replace(
        '작은',
        verse === 16 ? '작은' : verse === 17 ? '멋진' : '예쁜',
      ),
    })),
  };
  const projection = projectBible(
    {
      id: 'lookup',
      kind: 'bible',
      source: 'external',
      verseNumbers: false,
      translationName: false,
      reference: 'every',
      passage,
    },
    {element, layout},
  );
  if (projection === null) throw Error('Missing projection');
  const api = mockLlpApi({
    bible: {
      getLlmStatus: async () => ({
        status: 'ready',
        available: true,
        reason: '',
      }),
      chooseBoundary: vi.fn(async () => 0),
      cancelBoundary: vi.fn(async () => true),
    },
  }).bible;
  const cache = new BibleRefinements();
  return {projection, api, cache};
}

describe('Bible refinement run', () => {
  it('separates text layouts and prefixes and evicts older unsaved results at the cache bound', () => {
    const f = setup();
    const verse = f.projection.verses[0];
    if (verse === undefined) throw Error('Missing verse');
    f.cache.put(verse, f.projection.element, {prefix: '', cuts: [1]});
    expect(f.cache.get(verse, f.projection.element, '16 ')).toBeUndefined();
    expect(
      f.cache.get(
        verse,
        {
          ...f.projection.element,
          frame: {...f.projection.element.frame, w: 400},
        },
        '',
      ),
    ).toBeUndefined();
    for (let i = 0; i < 256; i++) {
      f.cache.put(
        {...verse, text: `${verse.text} ${i}`},
        f.projection.element,
        {prefix: '', cuts: [1]},
      );
    }
    expect(f.cache.get(verse, f.projection.element, '')).toBeUndefined();
  });
  it('publishes ready verses in queue order and drops late results after cancellation', async () => {
    const f = setup();
    const requests: Array<{
      request: BibleAiRequest;
      resolve: (index: number) => void;
    }> = [];
    vi.spyOn(f.api, 'chooseBoundary').mockImplementation(
      request => new Promise(resolve => requests.push({request, resolve})),
    );
    const run = new BibleRefinementRun(f.api, f.projection, f.cache);
    const work = run.start();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(run.getSnapshot().pending.size).toBe(3);
    const first = f.projection.verses[0];
    const second = f.projection.verses[1];
    if (first === undefined || second === undefined) {
      throw Error('Missing verses');
    }
    let completed = 0;
    while (requests.at(-1)?.request.fullText === first.text) {
      requests.at(-1)?.resolve(0);
      await vi.waitFor(() =>
        expect(requests.length).toBeGreaterThan(completed + 1),
      );
      completed++;
    }
    expect(run.getSnapshot().pending.has(verseKey(first.reference))).toBe(
      false,
    );
    expect(run.getSnapshot().pending.has(verseKey(second.reference))).toBe(
      true,
    );
    expect(f.cache.get(first, f.projection.element, '')).toBeDefined();
    const before = requests.length;
    run.cancel();
    requests.at(-1)?.resolve(0);
    await work;
    expect(f.api.cancelBoundary).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(before);
    expect(f.cache.get(second, f.projection.element, '')).toBeUndefined();
  });

  it('skips confirmed verses and quick sources without making an AI request', async () => {
    const f = setup();
    const confirmed: BibleProjection = {
      ...f.projection,
      parts: f.projection.parts.map(part => ({...part, manual: true})),
    };
    await new BibleRefinementRun(f.api, confirmed, f.cache).start();
    await new BibleRefinementRun(
      f.api,
      {...f.projection, source: {...f.projection.source, review: false}},
      f.cache,
    ).start();
    expect(f.api.chooseBoundary).not.toHaveBeenCalled();
  });

  it('reuses unsaved refinements for the same text and layout and uses rules with AI unavailable', async () => {
    const f = setup();
    await new BibleRefinementRun(f.api, f.projection, f.cache).start();
    expect(f.api.chooseBoundary).toHaveBeenCalled();
    vi.mocked(f.api.chooseBoundary).mockClear();
    await new BibleRefinementRun(f.api, f.projection, f.cache).start();
    expect(f.api.chooseBoundary).not.toHaveBeenCalled();
    vi.spyOn(f.api, 'getLlmStatus').mockResolvedValue({
      status: 'missing',
      available: false,
      reason: '',
    });
    const run = new BibleRefinementRun(
      f.api,
      f.projection,
      new BibleRefinements(),
    );
    await run.start();
    expect(run.getSnapshot()).toMatchObject({initialized: true});
    expect(run.getSnapshot().pending.size).toBe(0);
    expect(f.api.chooseBoundary).not.toHaveBeenCalled();
  });

  it('does not enqueue work when cancelled while reading readiness', async () => {
    const f = setup();
    let finish = (): void => undefined;
    vi.spyOn(f.api, 'getLlmStatus').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () =>
            resolve({status: 'ready', available: true, reason: ''});
        }),
    );
    const run = new BibleRefinementRun(f.api, f.projection, f.cache);
    const work = run.start();
    run.cancel();
    finish();
    await work;
    expect(f.api.chooseBoundary).not.toHaveBeenCalled();
  });
});

it('projects an effect onto the same verse part after splitting', () => {
  const {projection} = setup();
  if (projection.source.kind !== 'bible' || projection.parts[0] === undefined) {
    throw Error('Missing Bible part');
  }
  const first = projection.parts[0];
  const effect = {kind: 'wipe' as const, sec: 0.7};
  const again = projectBible(
    {
      ...projection.source,
      transitions: [
        {verse: first.reference, part: first.part, transition: effect},
      ],
    },
    {element: projection.element, layout: projection.layout},
  );
  expect(again?.tiles[0]?.transition).toEqual(effect);
  expect(again?.tiles[1]?.transition).toBeUndefined();
});
