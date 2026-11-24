import {lastLiveCommand} from '@fixtures/renderer/session/liveCommands';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import type {BibleLookupReply} from '@core/schema/bible/bibleLookup';
import {
  openItem,
  outputSlideOf,
  outputTile,
  selectTile,
  startServiceSync,
} from '@renderer/session/show/show';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {beginOutputRequest} from '@renderer/session/show/showOutput';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {openBiblePassage} from '@renderer/features/bible/passageActions';
import {
  bibleDocument,
  panelApi,
  panelPassage,
} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {useShow} from '@renderer/session/show/showStore';

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
  const view = useShow.getState();
  const source = bibleSourceFor(view, view.openItemId);
  if (!source) throw Error('Missing Bible source');
  return source;
}
function selectedVerse() {
  const {selectedTile} = useShow.getState();
  return currentSource().tiles[selectedTile]?.slide.verse?.verse;
}

async function setup() {
  const fixture = panelApi();
  fixture.push(translations());
  window.llp = fixture.api;
  openBiblePassage({...panelPassage(), translationLabel: '개역한글'});
  selectTile(1);
  const view = render(<BiblePanel sizeClass="normal" />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '역본'}).getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  return {...fixture, ...view};
}
async function choose(name = 'Alternate'): Promise<void> {
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '역본'}).getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', {name: '역본'}));
  fireEvent.click(await screen.findByRole('menuitemradio', {name}));
}

/** Follows the live slide as the window does, with a service that never loads. */
function followLive(api: NonNullable<typeof window.llp>): () => void {
  window.llp = {
    ...api,
    service: {...api.service, get: () => new Promise(() => undefined)},
  };
  return startServiceSync();
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  seedSampleService();
  useShow.setState({
    bibleSources: [],
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

describe('Bible preview display controls', () => {
  it('toggles the translation label in the preview and preserves it through numbering and output', async () => {
    const fixture = await setup();
    const original = currentSource();
    expect(
      screen
        .getByRole('checkbox', {name: '역본 이름'})
        .getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('checkbox', {name: '역본 이름'}));
    expect(currentSource().tiles[1]?.slide.texts['주소']).toBe(
      '요한복음 3:16-18 (개역한글)',
    );
    expect(currentSource().id).toBe(original.id);
    expect(useShow.getState().selectedTile).toBe(1);
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(currentSource().tiles[1]?.slide.texts['주소']).toBe(
      '요한복음 3:16-18 (개역한글)',
    );
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: '바로 띄우기'})).toBeNull();
    const tile = screen.getAllByRole('option')[1];
    if (tile === undefined) throw Error('Missing Bible slide');
    fireEvent.click(tile);
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      type: 'slide.show',
      slide: {texts: {주소: '요한복음 3:16-18 (개역한글)'}},
    });
    fireEvent.click(screen.getByRole('checkbox', {name: '역본 이름'}));
    expect(currentSource().tiles[1]?.slide.texts['주소']).toBeUndefined();
  });

  it('changes the verse on output at once when its numbering changes, as the same slide', async () => {
    const fixture = await setup();
    const stop = followLive(fixture.api);
    const original = currentSource();
    const verse = original.tiles[1]?.slide;
    const slide = outputSlideOf({itemId: original.id, index: 1});
    if (verse === undefined || slide === null) throw Error('Missing verse');
    const state = emptyLiveState();
    act(() => {
      useLive.setState({state: {...state, layers: {...state.layers, slide}}});
    });
    fixture.send.mockClear();
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(currentSource()).toMatchObject({
      id: original.id,
      verseNumbers: false,
    });
    expect(currentSource().tiles[1]?.slide).toMatchObject({
      id: verse.id,
      texts: {본문: 'Invented verse 17'},
    });
    expect(useShow.getState().selectedTile).toBe(1);
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      type: 'slide.update',
      slide: {slideId: verse.id, texts: {본문: 'Invented verse 17'}},
    });
    expect(fixture.edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    expect(currentSource().tiles[1]?.slide.texts['본문']).toBe(
      '17 Invented verse 17',
    );
    stop();
  });

  it('changes the verse on output to another translation at once, as the same slide, with its name', async () => {
    const fixture = await setup();
    const stop = followLive(fixture.api);
    const original = currentSource();
    const verse = original.tiles[1]?.slide;
    const slide = outputSlideOf({itemId: original.id, index: 1});
    if (verse === undefined || slide === null) throw Error('Missing verse');
    const state = emptyLiveState();
    act(() => {
      useLive.setState({state: {...state, layers: {...state.layers, slide}}});
    });
    fixture.send.mockClear();
    await choose();
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
    expect(currentSource()).toMatchObject({
      id: original.id,
      translationName: true,
    });
    expect(currentSource().tiles[1]?.slide.id).toBe(verse.id);
    expect(selectedVerse()).toBe(17);
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      type: 'slide.update',
      slide: {slideId: verse.id},
    });
    stop();
  });

  it('changes the translation of the passage, keeping numbering and the selected verse', async () => {
    const fixture = await setup();
    fireEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '역본'})
          .getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    await choose();
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe(alternate),
    );
    expect(currentSource().verseNumbers).toBe(false);
    expect(selectedVerse()).toBe(17);
    expect(fixture.lookup).toHaveBeenCalledExactlyOnceWith({
      translation: alternate,
      input: '요한복음 3:16-18',
    });
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.edit).not.toHaveBeenCalled();
    await choose('Invented');
    await waitFor(() =>
      expect(currentSource().passage.translation).toBe('sample'),
    );
    expect(useShow.getState().selectedTile).toBe(1);
    await choose('Invented');
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
      await choose();
      await waitFor(() =>
        expect(currentSource().passage.translation).toBe(alternate),
      );
      expect(selectedVerse()).toBe(selected === 17 ? 18 : 17);
    },
  );

  it('retains the preview and releases both controls after failure, then retries', async () => {
    const fixture = await setup();
    fixture.lookup.mockRejectedValueOnce(
      new Error('Invented unavailable translation'),
    );
    const original = currentSource();
    await choose();
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
    await choose();
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
    await choose();
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
      await choose();
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
    fireEvent.click(screen.getByRole('button', {name: '역본'}));
    const alternateOption = await screen.findByRole('menuitemradio', {
      name: 'Alternate',
    });
    vi.useFakeTimers();
    fixture.lookup.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(alternateOption);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    vi.useRealTimers();
    expect(currentSource()).toBe(original);
    expect(
      screen.getByRole('button', {name: '역본'}).getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('follows installed-list pushes and releases its subscription on close', async () => {
    const fixture = await setup();
    const listeners = fixture.listenerCount();
    expect(listeners).toBeGreaterThan(0);
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
    expect(fixture.listenerCount()).toBe(listeners);
    fixture.unmount();
    expect(fixture.listenerCount()).toBe(0);
  });
});
