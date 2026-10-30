import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/platform/live';
import {openItem, selectTile, useShow} from '@renderer/state/show';
import {openBiblePassage} from '../bible/actions';
import {panelPassage} from '../bible/panelTesting';
import {lookupRequest} from '../bible/testBible';
import {quickItemOn, quickItemUnavailable, quickRunner} from './quickActions';
import {
  deferred,
  quickFixture,
  quickId,
  quickItem,
  quickLive,
} from './quickTesting';

beforeEach(() => {
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
});
afterEach(() => {
  delete window.llp;
  vi.useRealTimers();
});

describe('quick execution', () => {
  it('opens a song and outputs its first slide without a background or service edit', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    const problem = vi.fn();
    await quickRunner(fixture.api, problem).run(quickItem('song'));
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'slide.show',
      slide: {
        itemId: `library:${quickId(101)}`,
        position: 0,
        label: '절 1',
        lines: ['Invented song'],
      },
    });
    expect(useShow.getState().librarySong).toEqual(fixture.song);
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(problem).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'reopens a saved Bible passage with numbering %s at the first verse and records output history',
    async numbers => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      openBiblePassage(panelPassage(), {verseNumbers: !numbers});
      selectTile(2);
      const item = quickItem('bible');
      if (item.kind !== 'bible') {
        throw new Error('Missing Bible item');
      }
      const stored = {...item, ref: {...item.ref, verseNumbers: numbers}};
      const problem = vi.fn();
      expect(quickItemUnavailable(stored)).toBeUndefined();
      await quickRunner(fixture.api, problem).run(stored);
      expect(fixture.lookup).toHaveBeenCalledWith({
        translation: 'sample',
        input: '요한복음 3:16-18',
      });
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          position: 0,
          lines: [
            `${numbers ? '16 ' : ''}Invented book 43, chapter 3, verse 16`,
          ],
        },
      });
      await vi.waitFor(() =>
        expect(fixture.document().value.recents[0]?.ref).toBe(
          panelPassage().ref,
        ),
      );
      expect(problem).not.toHaveBeenCalled();
    },
  );
  it('rejects unsupported passage display settings instead of discarding them', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    const item = quickItem('bible');
    if (item.kind !== 'bible') throw new Error('Missing Bible item');
    const problem = vi.fn();
    await quickRunner(fixture.api, problem).run({
      ...item,
      ref: {...item.ref, split: 'two'},
    });
    expect(fixture.lookup).not.toHaveBeenCalled();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(problem).toHaveBeenCalledOnce();
  });
  it('uses the active prop list even when a different prop is the primary id', () => {
    const live = emptyLiveState();
    expect(quickItemOn(quickItem('prop'), quickLive())).toBe(true);
    expect(
      quickItemOn(quickItem('prop'), {
        ...live,
        layers: {...live.layers, prop: {propId: quickId(103), items: []}},
      }),
    ).toBe(false);
  });
  it.each(['cancel', 'selection', 'clear', 'another item'])(
    'drops a delayed song after %s',
    async action => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      const song = deferred<typeof fixture.song | null>();
      fixture.showSong.mockReturnValueOnce(song.promise);
      const runner = quickRunner(fixture.api, vi.fn());
      const pending = runner.run(quickItem('song'));
      if (action === 'cancel') runner.cancel();
      if (action === 'selection') openItem('another-item');
      if (action === 'clear') {
        useLive.setState(view => ({commandVersion: view.commandVersion + 1}));
      }
      if (action === 'another item') await runner.run(quickItem('macro'));
      song.resolve(fixture.song);
      await pending;
      expect(
        fixture.send.mock.calls.some(
          ([command]) => command.type === 'slide.show',
        ),
      ).toBe(false);
      expect(useShow.getState().librarySong).toBeNull();
    },
  );
  it.each(['missing', 'rejected', 'empty', 'bible'])(
    'reports %s without changing live output',
    async failure => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      const problem = vi.fn();
      if (failure === 'missing') fixture.showSong.mockResolvedValueOnce(null);
      if (failure === 'rejected') {
        fixture.showSong.mockRejectedValueOnce(new Error('Invented failure'));
      }
      if (failure === 'empty') {
        fixture.showSong.mockResolvedValueOnce({...fixture.song, tiles: []});
      }
      if (failure === 'bible') {
        fixture.lookup.mockResolvedValueOnce({
          translation: lookupRequest().translation,
          input: '요한복음 3:16-18',
          suggestions: [],
          result: {
            ok: false,
            error: {code: 'translation', message: '사용할 수 없는 역본입니다'},
          },
        });
      }
      await quickRunner(fixture.api, problem).run(
        quickItem(failure === 'bible' ? 'bible' : 'song'),
      );
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.api.log.write).toHaveBeenCalledOnce();
      expect(problem).toHaveBeenCalledOnce();
    },
  );
  it('bounds a lookup and ignores its reply after timeout', async () => {
    vi.useFakeTimers();
    const fixture = quickFixture();
    window.llp = fixture.api;
    const problem = vi.fn();
    const song = deferred<typeof fixture.song | null>();
    fixture.showSong.mockReturnValueOnce(song.promise);
    const pending = quickRunner(fixture.api, problem).run(quickItem('song'));
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    song.resolve(fixture.song);
    await Promise.resolve();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(problem).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
