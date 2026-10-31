import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {
  openItem,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {seedSampleService} from '../../session/testing/sampleService';
import {BibleQuickField} from '../quick/BibleQuickField';
import {BiblePanel} from './BiblePanel';
import {openBiblePassage, showBiblePassage} from '../bible/actions';
import {
  bibleDocument,
  panelApi,
  panelPassage,
} from '@contracts/ipc/testing/bibleApi';
import {lookupRequest} from '@core/testing/bibleLookups';
import {formLookupReply} from '@core/testing/bibleReplies';

const alternate = lookupRequest('', 'alternate').translation;
function translations() {
  const document = bibleDocument();
  const first = document.value.translations[0];
  if (!first) throw Error('Missing installed translation fixture');
  return {
    ...document,
    value: {
      ...document.value,
      translations: [first, {...first, id: alternate, name: 'Alternate'}],
    },
  };
}
function currentSource() {
  const source = useShow.getState().bibleSource;
  if (!source) throw Error('Missing Bible source');
  return source;
}
async function setup() {
  const fixture = panelApi();
  fixture.push(translations());
  window.llp = fixture.api;
  openBiblePassage(panelPassage());
  selectTile(1);
  const view = render(<BiblePanel sizeClass="normal" />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '역본'}).getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  return {...fixture, ...view};
}
function choose(name = 'Alternate') {
  fireEvent.click(screen.getByRole('button', {name: '역본'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name}));
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

describe('Bible preview display controls', () => {
  it('toggles numbering without output, settings writes or losing selection and live text', async () => {
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
            lines: ['Invented live text'],
          },
        },
      },
    });
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(currentSource().verseNumbers).toBe(false);
    expect(currentSource().tiles[1]?.lines).toEqual(['Invented verse 17']);
    expect(useShow.getState().selectedTile).toBe(1);
    expect(bibleSourceFor(useShow.getState(), original.id)).toBe(original);
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(currentSource().verseNumbers).toBe(true);
    expect(currentSource().tiles[1]?.lines).toEqual(['17 Invented verse 17']);
  });

  it('changes only the preview translation, keeping numbering and the selected verse', async () => {
    const fixture = await setup();
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '역본'})
          .getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    choose();
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
    expect(currentSource().verseNumbers).toBe(false);
    expect(currentSource().tiles[useShow.getState().selectedTile]?.label).toBe(
      '3:17',
    );
    expect(fixture.lookup).toHaveBeenCalledExactlyOnceWith({
      translation: alternate,
      input: '요한복음 3:16-18',
    });
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.edit).not.toHaveBeenCalled();
    choose('Invented');
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe('sample'),
    );
    expect(useShow.getState().selectedTile).toBe(1);
    choose('Invented');
    expect(fixture.lookup).toHaveBeenCalledTimes(2);
  });

  it.each([17, 18])(
    'selects the next available verse or the last one when verse %s is omitted',
    async selected => {
      const fixture = await setup();
      act(() => selectTile(selected - 16));
      fixture.lookup.mockImplementation(async request => {
        const reply = await formLookupReply(request);
        if (!reply.result.ok) return reply;
        return {
          ...reply,
          result: {
            ok: true,
            value: {
              ...reply.result.value,
              verses: reply.result.value.verses.filter(
                verse => verse.verse !== selected,
              ),
            },
          },
        };
      });
      choose();
      await waitFor(() =>
        expect(currentSource().passage.translation).toBe(alternate),
      );
      expect(
        currentSource().tiles[useShow.getState().selectedTile]?.label,
      ).toBe(selected === 17 ? '3:18' : '3:17');
    },
  );

  it('retains the preview and releases both controls after failure, then retries', async () => {
    const fixture = await setup();
    fixture.lookup.mockRejectedValueOnce(
      new Error('Invented unavailable translation'),
    );
    const original = currentSource();
    choose();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '역본'})
          .getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    expect(currentSource()).toBe(original);
    expect(
      screen
        .getByRole('checkbox', {name: '절 번호'})
        .getAttribute('aria-disabled'),
    ).toBeNull();
    expect(fixture.send).not.toHaveBeenCalled();
    choose();
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
  });

  it('blocks duplicate translation choices and numbering while a lookup is pending', async () => {
    const fixture = await setup();
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    choose();
    fireEvent.click(screen.getByRole('button', {name: '역본'}));
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(currentSource().verseNumbers).toBe(true);
    expect(fixture.lookup).toHaveBeenCalledOnce();
    await act(async () =>
      finish(
        await formLookupReply(lookupRequest('요한복음 3:16-18', alternate)),
      ),
    );
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
  });

  it.each(['selection', 'output', 'intent', 'unmount'] as const)(
    'drops a delayed translation after %s',
    async cancel => {
      const fixture = await setup();
      let finish: (reply: BibleLookupReply) => void = () => undefined;
      fixture.lookup.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      choose();
      act(() => {
        if (cancel === 'selection') openItem('song-morning');
        if (cancel === 'output') {
          outputTile({itemId: currentSource().id, index: 1});
        }
        if (cancel === 'intent') beginOutputRequest();
        if (cancel === 'unmount') fixture.unmount();
      });
      const before = useShow.getState();
      const sends = fixture.send.mock.calls.length;
      await act(async () =>
        finish(
          await formLookupReply(lookupRequest('요한복음 3:16-18', alternate)),
        ),
      );
      expect(useShow.getState()).toBe(before);
      expect(fixture.send).toHaveBeenCalledTimes(sends);
    },
  );

  it('releases a timed-out lookup without changing the preview', async () => {
    const fixture = await setup();
    const original = currentSource();
    vi.useFakeTimers();
    fixture.lookup.mockReturnValueOnce(new Promise(() => undefined));
    choose();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    vi.useRealTimers();
    expect(currentSource()).toBe(original);
    expect(
      screen.getByRole('button', {name: '역본'}).getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('uses the selected translation on Enter after extension and show-now, then resets on a manual edit', async () => {
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
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '역본'})
          .getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    choose();
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
    fireEvent.click(screen.getByRole('button', {name: '뒤 절 추가'}));
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
    );
    act(() => showBiblePassage(currentSource().passage));
    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(currentSource().passage.translation).toBe(alternate);
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'bible:alternate:요한복음 3:16-19'},
    });
    fireEvent.change(book, {target: {value: '요한복음'}});
    expect(currentSource().passage.translation).toBe('sample');
    expect(currentSource().passage.ref).toBe('요한복음 3:16-18');
    fireEvent.click(screen.getByRole('button', {name: '뒤 절 추가'}));
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:16-19'),
    );
    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'bible:sample:요한복음 3:16-19'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: '끝절'}), {
      target: {value: '20'},
    });
    await waitFor(() =>
      expect(currentSource().passage.ref).toBe('요한복음 3:16-20'),
    );
    expect(currentSource().passage.translation).toBe('sample');
    expect(currentSource().enteredRef).toBeUndefined();
  });

  it('follows installed-list pushes and releases its subscription on close', async () => {
    const fixture = await setup();
    const document = translations();
    act(() =>
      fixture.push({
        ...document,
        revision: 2,
        value: {
          ...document.value,
          translations: document.value.translations.slice(0, 1),
        },
      }),
    );
    fireEvent.click(screen.getByRole('button', {name: '역본'}));
    expect(screen.queryByRole('menuitemradio', {name: 'Alternate'})).toBeNull();
    expect(fixture.listenerCount()).toBe(1);
    fixture.unmount();
    expect(fixture.listenerCount()).toBe(0);
  });
});
