import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {bibleVerseTiles} from '@shared/bibleTiles';
import {emptyLiveState} from '@shared/live';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import {sendLive, useLive} from '@renderer/state/live';
import {
  openItem,
  outputNext,
  outputPrevious,
  selectTile,
  useShow,
} from '@renderer/state/show';
import {
  beginOutputRequest,
  LOOKUP_TIMEOUT_MS,
} from '@renderer/state/showOutput';
import {handleShowKey} from '../shortcuts';
import {seedSampleService} from '../testing/sampleService';
import {openBiblePassage} from './actions';
import {BiblePanel} from './BiblePanel';
import {panelApi} from './panelTesting';
import {lookupRequest} from './testBible';
import {formLookupReply} from './testing/referenceForm';
import {outputAdjacentBibleVerse} from './verseShortcuts';

async function setup(input = '요한복음 3:16-18', verseNumbers = true) {
  const fixture = panelApi();
  window.llp = fixture.api;
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid verse shortcut fixture');
  const passage = reply.result.value;
  openBiblePassage(passage, {verseNumbers});
  const source = useShow.getState().bibleSource;
  if (!source) throw Error('Missing Bible source');
  const position = source.tiles.length - 1;
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        slide: {
          itemId: source.id,
          position,
          label: source.tiles[position]?.label ?? null,
          lines: [],
        },
      },
    },
  });
  selectTile(position);
  return {...fixture, passage};
}

function acceptOutput(fixture: ReturnType<typeof panelApi>): void {
  const command = fixture.send.mock.calls.at(-1)?.[0];
  if (command?.type !== 'slide.show') throw Error('Missing slide output');
  const state = emptyLiveState();
  useLive.setState({
    state: {...state, layers: {...state.layers, slide: command.slide}},
  });
}

async function setupSaved(verseNumbers = true) {
  const fixture = await setup(undefined, verseNumbers);
  const id = 'saved-bible';
  const rows = [
    {
      id,
      kind: 'bible',
      title: fixture.passage.ref,
      bible: {
        ref: fixture.passage.ref,
        translation: fixture.passage.translation,
        verseNumbers,
      },
    },
  ] as const;
  useShow.setState({
    bibleSource: null,
    openItemId: id,
    rows,
    tiles: {[id]: bibleVerseTiles(fixture.passage, verseNumbers)},
  });
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        slide: {itemId: id, position: 2, label: '3:18', lines: []},
      },
    },
  });
  return {...fixture, rows};
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  seedSampleService();
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.llp;
});

describe('Bible verse shortcuts', () => {
  it('advances past an omitted verse without outputting an existing verse again', async () => {
    const fixture = await setup();
    fixture.lookup.mockImplementation(async request => {
      const reply = await formLookupReply(request);
      return reply.result.ok && request.input === '요한복음 3:16-19'
        ? {
            ...reply,
            result: {
              ok: true,
              value: {...reply.result.value, verses: fixture.passage.verses},
            },
          }
        : reply;
    });
    await outputAdjacentBibleVerse('next');
    expect(useShow.getState().bibleSource?.passage.ref).toBe(
      '요한복음 3:16-19',
    );
    expect(fixture.send).not.toHaveBeenCalled();
    await outputAdjacentBibleVerse('next');
    expect(useShow.getState().bibleSource?.passage.ref).toBe(
      '요한복음 3:16-20',
    );
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      slide: {label: '3:20'},
    });
  });
  it.each([true, false])(
    'adds and outputs the next endpoint with numbering %s and keeps the live ring and navigation',
    async verseNumbers => {
      const fixture = await setup(undefined, verseNumbers);
      render(<BiblePanel sizeClass="normal" />);
      outputNext();
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.lookup).not.toHaveBeenCalled();
      await act(() => outputAdjacentBibleVerse('next'));
      expect(useShow.getState().bibleSource?.passage.ref).toBe(
        '요한복음 3:16-19',
      );
      expect(useShow.getState().bibleSource?.verseNumbers).toBe(verseNumbers);
      expect(fixture.send).toHaveBeenCalledTimes(1);
      expect(fixture.send.mock.calls[0]?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          position: 3,
          label: '3:19',
          lines: [
            `${verseNumbers ? '19 ' : ''}Invented book 43, chapter 3, verse 19`,
          ],
        },
      });
      act(() => acceptOutput(fixture));
      expect(
        screen
          .getAllByRole('option')
          .filter(tile => tile.dataset.state?.split(' ').includes('live')),
      ).toEqual([screen.getAllByRole('option')[3]]);
      act(() => outputPrevious());
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        slide: {position: 2, label: '3:18'},
      });
      act(() => acceptOutput(fixture));
      act(() => outputNext());
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        slide: {position: 3, label: '3:19'},
      });
      act(() => acceptOutput(fixture));
      fixture.send.mockClear();
      act(() => outputNext());
      expect(fixture.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      direction: 'next',
      input: '요한복음 3:35-36',
      ref: '요한복음 3:35-4:1',
      label: '4:1',
    },
    {
      direction: 'previous',
      input: '요한복음 3:1-2',
      ref: '요한복음 2:8-3:2',
      label: '2:8',
    },
  ] as const)(
    'extends the $direction endpoint across chapters and outputs it',
    async ({direction, input, ref, label}) => {
      const fixture = await setup(input);
      await outputAdjacentBibleVerse(direction);
      expect(useShow.getState().bibleSource?.passage.ref).toBe(ref);
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {label},
      });
    },
  );

  it('extends a saved service Bible passage without editing the service', async () => {
    const fixture = await setupSaved();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    await outputAdjacentBibleVerse('next');
    expect(useShow.getState().rows).toBe(fixture.rows);
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {label: '3:19'},
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it.each(['previous', 'next'] as const)(
    'keeps saved verse numbering disabled when adding the %s verse',
    async direction => {
      const fixture = await setupSaved(false);
      await outputAdjacentBibleVerse(direction);
      const verse = direction === 'previous' ? 15 : 19;
      expect(useShow.getState().bibleSource?.verseNumbers).toBe(false);
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          label: `3:${verse}`,
          lines: [`Invented book 43, chapter 3, verse ${verse}`],
        },
      });
      expect(useShow.getState().rows).toBe(fixture.rows);
    },
  );

  it.each(['previous', 'next'] as const)(
    'keeps the saved live verse mapped after an omitted %s endpoint',
    async direction => {
      const fixture = await setupSaved(false);
      const omitted = direction === 'previous' ? 15 : 19;
      fixture.lookup.mockImplementation(async request => {
        const reply = await formLookupReply(request);
        return reply.result.ok
          ? {
              ...reply,
              result: {
                ok: true,
                value: {
                  ...reply.result.value,
                  verses: reply.result.value.verses.filter(
                    verse => verse.verse !== omitted,
                  ),
                },
              },
            }
          : reply;
      });
      render(<BiblePanel sizeClass="normal" />);
      await act(() => outputAdjacentBibleVerse(direction));
      expect(fixture.send).not.toHaveBeenCalled();
      expect(useShow.getState().liveBibleSource).toBeNull();
      const liveTiles = screen
        .getAllByRole('option')
        .filter(tile => tile.dataset.state?.split(' ').includes('live'));
      expect(liveTiles).toEqual([screen.getAllByRole('option')[2]]);
      await act(() => outputAdjacentBibleVerse(direction));
      const verse = direction === 'previous' ? 14 : 20;
      expect(fixture.send).toHaveBeenCalledTimes(1);
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          label: `3:${verse}`,
          lines: [`Invented book 43, chapter 3, verse ${verse}`],
        },
      });
      expect(useShow.getState().rows).toBe(fixture.rows);
    },
  );

  it('does nothing for a song, a preview without live output, or a different open passage', async () => {
    const fixture = await setup();
    useLive.setState({state: emptyLiveState()});
    await outputAdjacentBibleVerse('next');
    openItem('song-1');
    await outputAdjacentBibleVerse('next');
    expect(fixture.lookup).not.toHaveBeenCalled();
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('handles Shift Right through the show key handler and ignores a held key', async () => {
    const fixture = await setup();
    await act(async () => {
      handleShowKey(
        new KeyboardEvent('keydown', {code: 'ArrowRight', shiftKey: true}),
      );
      handleShowKey(
        new KeyboardEvent('keydown', {
          code: 'ArrowRight',
          shiftKey: true,
          repeat: true,
        }),
      );
    });
    expect(fixture.lookup).toHaveBeenCalledTimes(2);
    expect(fixture.send).toHaveBeenCalledTimes(1);
  });

  it.each(['previous', 'next'] as const)(
    'keeps output at the %s book boundary',
    async direction => {
      const fixture = await setup(
        direction === 'previous' ? '창세기 1:1' : '요한복음 21:8',
      );
      const source = useShow.getState().bibleSource;
      await outputAdjacentBibleVerse(direction);
      expect(useShow.getState().bibleSource).toBe(source);
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.lookup).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['metadata', 'selection'],
    ['passage', 'selection'],
    ['metadata', 'clear'],
    ['passage', 'clear'],
    ['passage', 'item'],
    ['passage', 'service'],
  ] as const)(
    'discards delayed %s after a change to %s',
    async (phase, change) => {
      const fixture = await setup();
      let resolve: ((reply: BibleLookupReply) => void) | undefined;
      const pending = new Promise<BibleLookupReply>(done => {
        resolve = done;
      });
      if (phase === 'metadata') {
        fixture.lookup.mockImplementationOnce(() => pending);
      } else {
        fixture.lookup
          .mockImplementationOnce(formLookupReply)
          .mockImplementationOnce(() => pending);
      }
      const output = outputAdjacentBibleVerse('next');
      await vi.waitFor(() =>
        expect(fixture.lookup).toHaveBeenCalledTimes(
          phase === 'metadata' ? 1 : 2,
        ),
      );
      switch (change) {
        case 'selection':
          selectTile(0);
          break;
        case 'clear':
          sendLive({type: 'layer.clear', target: 'slide'});
          break;
        case 'item':
          openItem('another-item');
          break;
        case 'service':
          useShow.setState({serviceId: 'another-service'});
          break;
      }
      resolve?.(
        await formLookupReply(
          lookupRequest(phase === 'metadata' ? '요한복음' : '요한복음 3:16-19'),
        ),
      );
      await output;
      expect(fixture.send).toHaveBeenCalledTimes(change === 'clear' ? 1 : 0);
      expect(useShow.getState().bibleSource?.passage.ref).toBe(
        '요한복음 3:16-18',
      );
    },
  );

  it('cancels an old lookup when another output request starts', async () => {
    const fixture = await setup();
    fixture.lookup.mockImplementationOnce(async request => {
      beginOutputRequest();
      return formLookupReply(request);
    });
    await outputAdjacentBibleVerse('next');
    expect(fixture.lookup).toHaveBeenCalledTimes(1);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('bounds a failed lookup and retains the last good output', async () => {
    const fixture = await setup();
    const log = vi.spyOn(fixture.api.log, 'write');
    fixture.lookup.mockImplementationOnce(() => new Promise(() => undefined));
    vi.useFakeTimers();
    const output = outputAdjacentBibleVerse('next');
    await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS);
    await output;
    expect(log).toHaveBeenCalledWith(expect.objectContaining({level: 'error'}));
    expect(fixture.send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
