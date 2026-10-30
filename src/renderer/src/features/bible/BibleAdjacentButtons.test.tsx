import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {emptyLiveState} from '@core/live/state';
import {
  openItem,
  outputNext,
  outputPrevious,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/state/show';
import {useLive} from '@renderer/platform/live';
import {bibleSourceFor} from '@renderer/state/showLibrary';
import {beginOutputRequest} from '@renderer/state/showOutput';
import {seedSampleService} from '../../show/testing/sampleService';
import {BibleQuickField} from '../../show/quick/BibleQuickField';
import {BiblePanel} from './BiblePanel';
import {openBiblePassage, showBiblePassage} from './actions';
import {adjacentVerseRange} from '@core/bible/adjacentVerses';
import {panelApi} from './panelTesting';
import {lookupRequest} from './testBible';
import {formLookupReply} from './testing/referenceForm';

async function passage(input = '요한복음 3:16-18') {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid adjacent-verse fixture');
  return reply.result.value;
}

async function setup(input?: string, verseNumbers = true) {
  const fixture = panelApi();
  window.llp = fixture.api;
  openBiblePassage(await passage(input), {verseNumbers});
  selectTile(1);
  const view = render(<BiblePanel sizeClass="normal" />);
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
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
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
      const liveTiles = screen
        .getAllByRole('option')
        .filter(tile => tile.dataset.state?.split(' ').includes('live'));
      expect(liveTiles).toEqual([screen.getAllByRole('option')[2]]);
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

  it('goes on from the live verse with the next and previous 장 keys after the passage grows', async () => {
    const fixture = await setup();
    const original = currentSource();
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
      expect(currentSource().passage.ref).toBe('요한복음 3:15-18'),
    );
    act(() => outputNext());
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: 'bible:sample:요한복음 3:15-18',
        position: 3,
        label: '3:18',
      },
    });
    act(() => outputPrevious());
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: 'bible:sample:요한복음 3:15-18',
        position: 1,
        label: '3:16',
      },
    });
  });

  it.each([
    ['previous', '요한복음 3:1-2', '요한복음 2:8-3:2'],
    ['next', '요한복음 3:35-36', '요한복음 3:35-4:1'],
  ] as const)(
    'adds the %s verse across a chapter boundary',
    async (direction, input, expected) => {
      const fixture = await setup(input);
      fireEvent.click(button(direction));
      await waitFor(() =>
        expect(useShow.getState().bibleSource?.passage.ref).toBe(expected),
      );
      expect(useShow.getState().selectedTile).toBe(
        direction === 'previous' ? 2 : 1,
      );
      expect(useShow.getState().bibleSource?.tiles).toHaveLength(3);
      expect(fixture.send).not.toHaveBeenCalled();
    },
  );

  it('extends canonical range endpoints past omitted text and whole-chapter references', async () => {
    const reply = await formLookupReply(lookupRequest('요한복음 3'));
    if (!reply.result.ok || !reply.bounds) {
      throw Error('Invalid whole chapter fixture');
    }
    expect(
      adjacentVerseRange(reply.result.value, reply.bounds, 'previous'),
    ).toBe('요한복음 2:8-3:36');
    expect(adjacentVerseRange(reply.result.value, reply.bounds, 'next')).toBe(
      '요한복음 3:1-4:1',
    );
    const range = await passage();
    const omitted = {...range, verses: range.verses.slice(1, 2)};
    expect(adjacentVerseRange(omitted, reply.bounds, 'previous')).toBe(
      '요한복음 3:15-18',
    );
    expect(adjacentVerseRange(omitted, reply.bounds, 'next')).toBe(
      '요한복음 3:16-19',
    );
    expect(
      adjacentVerseRange(range, {...reply.bounds, bookId: 1}, 'next'),
    ).toBeNull();
  });

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

  it('cancels an extension when a new manual book edit starts', async () => {
    const fixture = await setup();
    render(<BibleQuickField api={fixture.api} />);
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).disabled,
      ).toBe(false),
    );
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.click(button('next'));
    fireEvent.change(screen.getByRole('combobox', {name: '책'}), {
      target: {value: '베'},
    });
    const source = useShow.getState().bibleSource;
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음'))),
    );
    expect(useShow.getState().bibleSource).toBe(source);
    expect(fixture.lookup).toHaveBeenCalledOnce();
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('outputs the expanded range from unchanged fields, then starts a new range after an edit', async () => {
    const fixture = await setup();
    render(<BibleQuickField api={fixture.api} />);
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    await waitFor(() => expect(book.disabled).toBe(false));
    fireEvent.change(book, {target: {value: '요'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '16'],
      ['끝절', '18'],
    ] as const) {
      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });
    }
    await waitFor(() =>
      expect(
        fixture.lookup.mock.calls.some(
          ([request]) => request.input === '요한복음 3:16-18',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:16-18'),
    );
    act(() => selectTile(1));
    fireEvent.click(button('previous'));
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:15-18'),
    );
    fireEvent.click(button('next'));
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:15-19'),
    );
    act(() => showBiblePassage(currentSource().passage));
    const shown = fixture.send.mock.calls.at(-1)?.[0];
    expect(shown).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: 'bible:sample:요한복음 3:15-19',
        position: 2,
        label: '3:17',
      },
    });
    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(fixture.send.mock.calls.at(-1)?.[0]).toEqual(shown);
    fireEvent.change(screen.getByRole('textbox', {name: '끝절'}), {
      target: {value: '20'},
    });
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:16-20'),
    );
    expect(currentSource().enteredRef).toBeUndefined();
    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: 'bible:sample:요한복음 3:16-20',
        position: 0,
        label: '3:16',
      },
    });
  });

  it.each([false, true])(
    'restores an equivalent edit before output or re-extension (%s)',
    async extendAgain => {
      const fixture = await setup();
      render(<BibleQuickField api={fixture.api} />);
      const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
      await waitFor(() => expect(book.disabled).toBe(false));
      fireEvent.change(book, {target: {value: '요'}});
      for (const [label, value] of [
        ['장', '3'],
        ['시작절', '16'],
        ['끝절', '18'],
      ] as const) {
        fireEvent.change(screen.getByRole('textbox', {name: label}), {
          target: {value},
        });
      }
      await waitFor(() =>
        expect(
          fixture.lookup.mock.calls.some(
            ([request]) => request.input === '요한복음 3:16-18',
          ),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(currentSource().passage.ref).toBe('요한복음 3:16-18'),
      );
      fireEvent.click(button('next'));
      await waitFor(() =>
        expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
      );
      fireEvent.change(book, {target: {value: '요한복음'}});
      expect(currentSource().enteredRef).toBeUndefined();
      expect(currentSource().passage.ref).toBe('요한복음 3:16-18');
      if (extendAgain) {
        fireEvent.click(button('next'));
        await waitFor(() =>
          expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
        );
      }
      fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
        key: 'Enter',
      });
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          itemId: `bible:sample:요한복음 3:16-${extendAgain ? '19' : '18'}`,
        },
      });
    },
  );

  it.each([false, true])(
    'restores a reselected recent before show-now or re-extension (%s)',
    async extendAgain => {
      const fixture = await setup();
      fixture.push({
        ...fixture.document(),
        revision: 2,
        value: {
          ...fixture.document().value,
          recents: [
            {translation: lookupRequest().translation, ref: '요한복음 3:16-18'},
          ],
        },
      });
      render(<BibleQuickField api={fixture.api} />);
      const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
      await waitFor(() => expect(book.disabled).toBe(false));
      fireEvent.change(book, {target: {value: '요'}});
      for (const [label, value] of [
        ['장', '3'],
        ['시작절', '16'],
        ['끝절', '18'],
      ] as const) {
        fireEvent.change(screen.getByRole('textbox', {name: label}), {
          target: {value},
        });
      }
      await waitFor(() =>
        expect(
          fixture.lookup.mock.calls.some(
            ([request]) => request.input === '요한복음 3:16-18',
          ),
        ).toBe(true),
      );
      await waitFor(() =>
        expect(currentSource().passage.ref).toBe('요한복음 3:16-18'),
      );
      fireEvent.click(screen.getByRole('button', {name: '바로 띄우기'}));
      fireEvent.click(button('next'));
      await waitFor(() =>
        expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
      );
      fireEvent.focus(book);
      fireEvent.click(screen.getByRole('option', {name: /요한복음 3:16-18/}));
      expect(currentSource().passage.ref).toBe('요한복음 3:16-18');
      if (extendAgain) {
        fireEvent.click(button('next'));
        await waitFor(() =>
          expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
        );
        fireEvent.keyDown(book, {key: 'Enter'});
      } else {
        fireEvent.click(screen.getByRole('button', {name: '바로 띄우기'}));
      }
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          itemId: `bible:sample:요한복음 3:16-${extendAgain ? '19' : '18'}`,
        },
      });
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
