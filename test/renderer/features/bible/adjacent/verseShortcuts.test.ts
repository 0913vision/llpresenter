import {act} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import type {BibleLookupReply} from '@core/schema/bible/bibleLookup';
import {openBiblePassage} from '@renderer/features/bible/actions';
import {outputAdjacentBibleVerse} from '@renderer/features/bible/adjacent/verseShortcuts';
import {useLive} from '@renderer/session/live';
import {openItem, outputSlideOf, useShow} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {beginOutputRequest} from '@renderer/session/show/showOutput';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {lastLiveCommand} from '@fixtures/renderer/session/liveCommands';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';

const ends = {previous: 0, next: 2} as const;

/** Opens 요한복음 3:16-18 with one of its verses on output. */
async function setup(position: number, verseNumbers = true) {
  const fixture = panelApi();
  window.llp = fixture.api;
  const reply = await formLookupReply(lookupRequest('요한복음 3:16-18'));
  if (!reply.result.ok) throw new Error('Invalid passage');
  const source = openBiblePassage(reply.result.value, {verseNumbers});
  goLive(source.id, position);
  return {...fixture, source};
}

function goLive(itemId: string, index: number): void {
  const slide = outputSlideOf({itemId, index});
  if (slide === null) throw new Error('No slide');
  const state = emptyLiveState();
  act(() =>
    useLive.setState({state: {...state, layers: {...state.layers, slide}}}),
  );
}

const open = () => {
  const view = useShow.getState();
  return bibleSourceFor(view, view.openItemId);
};

beforeEach(() => {
  seedSampleService();
  useShow.setState({bibleSources: [], openItemId: null, selectedTile: 0});
  useLive.setState({state: emptyLiveState(), lastStartedItemId: null});
});
afterEach(() => {
  delete window.llp;
});

describe('the verse beside the live one', () => {
  it.each([
    ['previous', 1, 16],
    ['next', 1, 18],
  ] as const)(
    'shows the %s one of the passage',
    async (direction, from, verse) => {
      const fixture = await setup(from);
      await outputAdjacentBibleVerse(direction);
      expect(fixture.lookup).not.toHaveBeenCalled();
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {verse: {verse}},
      });
    },
  );

  it.each([
    ['previous', 15, '요한복음 3:15-18'],
    ['next', 19, '요한복음 3:16-19'],
  ] as const)(
    'adds the %s verse to the passage at its end',
    async (direction, verse, ref) => {
      const fixture = await setup(ends[direction]);
      const before = open()?.slides ?? [];
      await outputAdjacentBibleVerse(direction);
      expect(open()?.passage.ref).toBe(ref);
      expect(open()?.slides).toEqual(
        expect.arrayContaining([...before.slice(1, 2)]),
      );
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({type: 'slide.show', slide: {verse: {verse}}});
    },
  );

  it('keeps the numbers off when the passage has none', async () => {
    const fixture = await setup(ends.next, false);
    await outputAdjacentBibleVerse('next');
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      slide: {texts: {본문: 'Invented book 43, chapter 3, verse 19'}},
    });
  });

  it('does nothing while no verse is on output', async () => {
    const fixture = await setup(1);
    useLive.setState({state: emptyLiveState()});
    await outputAdjacentBibleVerse('next');
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it.each(['another item', 'another output'] as const)(
    'drops an answer that comes after %s',
    async cancel => {
      const fixture = await setup(ends.next);
      let finish: (reply: BibleLookupReply) => void = () => undefined;
      fixture.lookup.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      const pending = outputAdjacentBibleVerse('next');
      if (cancel === 'another item') openItem('song-morning');
      else beginOutputRequest();
      finish(await formLookupReply(lookupRequest('요한복음')));
      await pending;
      expect(fixture.send).not.toHaveBeenCalled();
    },
  );

  it('keeps the live verse when the next one cannot be read', async () => {
    const fixture = await setup(ends.next);
    fixture.lookup.mockRejectedValueOnce(new Error('Invented failure'));
    await outputAdjacentBibleVerse('next');
    expect(fixture.send).not.toHaveBeenCalled();
    expect(open()?.passage.ref).toBe('요한복음 3:16-18');
  });
});
