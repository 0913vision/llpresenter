import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {JSX} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {emptyLiveState} from '@core/live/state';
import {
  openItem,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {BibleAdjacentButtons} from '@renderer/features/bible/BibleAdjacentButtons';
import {openBiblePassage} from '@renderer/features/bible/actions';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';

async function passage(input = '요한복음 3:16-18') {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid adjacent-verse fixture');
  return reply.result.value;
}

function CurrentButtons(): JSX.Element | null {
  const source = useShow(view => bibleSourceFor(view, view.openItemId));
  return source === null ? null : (
    <BibleAdjacentButtons key={source.id} source={source} />
  );
}

async function setup(input?: string, verseNumbers = true) {
  const fixture = panelApi();
  window.llp = fixture.api;
  openBiblePassage(await passage(input), {verseNumbers});
  selectTile(1);
  const view = render(<CurrentButtons />);
  return {...fixture, ...view};
}

function button(direction: 'previous' | 'next') {
  return screen.getByRole('button', {
    name: direction === 'previous' ? '앞 절 추가' : '뒤 절 추가',
  });
}

function currentSource() {
  const source = useShow.getState().bibleSource;
  if (!source) throw Error('Missing current Bible fixture');
  return source;
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
  useLive.setState({state: emptyLiveState(), lastStartedItemId: null});
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.useRealTimers();
});

describe('adjacent Bible verses', () => {
  it.each([true, false])(
    'extends both ends while retaining numbering %s, the selected verse and live source',
    async verseNumbers => {
      const fixture = await setup(undefined, verseNumbers);
      const original = useShow.getState().bibleSource;
      if (!original) throw Error('Missing Bible preview');
      const live = emptyLiveState();
      useLive.setState({
        state: {
          ...live,
          layers: {
            ...live.layers,
            slide: {
              itemId: original.id,
              position: 1,
              label: '3:17',
              lines: ['Invented live verse'],
            },
          },
        },
      });
      fireEvent.click(button('previous'));
      await waitFor(() =>
        expect(useShow.getState().bibleSource?.passage.ref).toBe(
          '요한복음 3:15-18',
        ),
      );
      expect(useShow.getState().selectedTile).toBe(2);
      fireEvent.click(button('next'));
      await waitFor(() =>
        expect(useShow.getState().bibleSource?.passage.ref).toBe(
          '요한복음 3:15-19',
        ),
      );
      const view = useShow.getState();
      expect(view.selectedTile).toBe(2);
      expect(view.bibleSource?.verseNumbers).toBe(verseNumbers);
      expect(view.bibleSource?.tiles[2]?.label).toBe('3:17');
      expect(view.bibleSource?.tiles[2]?.lines[0]).toBe(
        `${verseNumbers ? '17 ' : ''}Invented book 43, chapter 3, verse 17`,
      );
      expect(bibleSourceFor(view, original.id)).toBe(original);
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.edit).not.toHaveBeenCalled();
      expect(
        fixture.lookup.mock.calls.map(([request]) => request.input),
      ).toEqual([
        '요한복음',
        '요한복음 3:15-18',
        '요한복음',
        '요한복음 3:15-19',
      ]);
    },
  );

  it('keeps book boundaries closed without wrapping or output', async () => {
    const fixture = await setup('요한복음 1:1');
    expect(button('previous').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button('previous'));
    expect(fixture.lookup).not.toHaveBeenCalled();
    act(() =>
      openBiblePassage({
        ...currentSource().passage,
        ref: '요한복음 21:8',
        verses: [{chapter: 21, verse: 8, text: 'Invented last verse'}],
      }),
    );
    fireEvent.click(button('next'));
    await waitFor(() =>
      expect(button('next').getAttribute('aria-disabled')).toBe('true'),
    );
    await waitFor(() =>
      expect(button('previous').getAttribute('aria-disabled')).toBeNull(),
    );
    fireEvent.click(button('next'));
    expect(fixture.lookup).toHaveBeenCalledOnce();
    expect(useShow.getState().bibleSource?.passage.ref).toBe('요한복음 21:8');
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('locks both buttons until the extension completes', async () => {
    const fixture = await setup();
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.click(button('previous'));
    fireEvent.click(button('previous'));
    fireEvent.click(button('next'));
    expect(fixture.lookup).toHaveBeenCalledOnce();
    expect(button('next').getAttribute('aria-disabled')).toBe('true');
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음'))),
    );
    await waitFor(() =>
      expect(useShow.getState().bibleSource?.passage.ref).toBe(
        '요한복음 3:15-18',
      ),
    );
    expect(fixture.lookup).toHaveBeenCalledTimes(2);
  });

  it.each(['metadata', 'passage'] as const)(
    'drops delayed %s after selection, output, intent, replacement or unmount',
    async phase => {
      for (const cancel of [
        'selection',
        'output',
        'intent',
        'replacement',
        'unmount',
      ] as const) {
        const fixture = await setup();
        let finish: (reply: BibleLookupReply) => void = () => undefined;
        fixture.lookup.mockImplementation(request => {
          if ((request.input === '요한복음') === (phase === 'metadata')) {
            return new Promise(resolve => {
              finish = resolve;
            });
          }
          return formLookupReply(request);
        });
        fireEvent.click(button('next'));
        await waitFor(() =>
          expect(fixture.lookup).toHaveBeenCalledTimes(
            phase === 'metadata' ? 1 : 2,
          ),
        );
        act(() => {
          if (cancel === 'selection') openItem('song-morning');
          if (cancel === 'output') {
            outputTile({itemId: currentSource().id, index: 1});
          }
          if (cancel === 'intent') beginOutputRequest();
          if (cancel === 'replacement') {
            openBiblePassage({
              ...currentSource().passage,
              ref: '요한복음 3:16',
            });
          }
          if (cancel === 'unmount') fixture.unmount();
        });
        const before = useShow.getState();
        const sends = fixture.send.mock.calls.length;
        await act(async () =>
          finish(
            await formLookupReply(
              lookupRequest(
                phase === 'metadata' ? '요한복음' : '요한복음 3:16-19',
              ),
            ),
          ),
        );
        expect(useShow.getState()).toBe(before);
        expect(fixture.send).toHaveBeenCalledTimes(sends);
        fixture.unmount();
      }
    },
  );

  it.each(['metadata', 'passage', 'timeout'] as const)(
    'retains the preview after a %s failure and allows retry',
    async failure => {
      const fixture = await setup();
      const source = useShow.getState().bibleSource;
      if (failure === 'timeout') {
        vi.useFakeTimers();
        fixture.lookup.mockReturnValueOnce(new Promise(() => undefined));
      } else if (failure === 'metadata') {
        fixture.lookup.mockRejectedValueOnce(
          new Error('Invented read failure'),
        );
      } else {
        fixture.lookup
          .mockImplementationOnce(formLookupReply)
          .mockResolvedValueOnce({
            ...lookupRequest(),
            suggestions: [],
            result: {
              ok: false,
              error: {code: 'translation', message: '역본 조회 실패'},
            },
          });
      }
      fireEvent.click(button('next'));
      if (failure === 'timeout') {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2100);
        });
        vi.useRealTimers();
      }
      await waitFor(() =>
        expect(button('next').getAttribute('aria-disabled')).toBeNull(),
      );
      expect(useShow.getState().bibleSource).toBe(source);
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.edit).not.toHaveBeenCalled();
      fireEvent.click(button('next'));
      await waitFor(() =>
        expect(useShow.getState().bibleSource?.passage.ref).toBe(
          '요한복음 3:16-19',
        ),
      );
    },
  );
});
