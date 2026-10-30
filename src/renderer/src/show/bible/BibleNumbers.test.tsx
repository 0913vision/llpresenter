import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {defaultPreferences, type Preferences} from '@core/schema/preferences';
import {useLive} from '@renderer/platform/live';
import {
  outputPrevious,
  revealLiveItem,
  selectTile,
  useShow,
} from '@renderer/state/show';
import {BibleQuickField} from '../quick/BibleQuickField';
import {BiblePanel} from './BiblePanel';
import {panelApi} from './panelTesting';

function fixture(verseNumbers: boolean) {
  const panel = panelApi();
  const listeners = new Set<(value: Preferences) => void>();
  const stop = vi.fn();
  let value = {
    ...defaultPreferences,
    bible: {...defaultPreferences.bible, verseNumbers},
  };
  const api = {
    ...panel.api,
    preferences: {
      get: async () => value,
      subscribe: (listener: (value: Preferences) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          stop();
        };
      },
    },
  };
  return {
    ...panel,
    api,
    stop,
    push: (numbers: boolean) => {
      const next = {...value, bible: {...value.bible, verseNumbers: numbers}};
      value = next;
      for (const listener of listeners) listener(next);
    },
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
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
});

async function enterReference() {
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  await waitFor(() => expect(book.disabled).toBe(false));
  fireEvent.change(book, {target: {value: '요'}});
  for (const [name, value] of [
    ['장', '3'],
    ['시작절', '16'],
    ['끝절', '18'],
  ] as const) {
    fireEvent.change(screen.getByRole('textbox', {name}), {target: {value}});
  }
  await waitFor(() =>
    expect(useShow.getState().bibleSource?.passage.ref).toBe(
      '요한복음 3:16-18',
    ),
  );
  return book;
}

describe('quick Bible verse-number defaults', () => {
  it.each([true, false])(
    'uses the configured numbering %s for preview and the selected Enter output',
    async numbers => {
      const test = fixture(numbers);
      window.llp = test.api;
      const view = render(
        <>
          <BibleQuickField api={test.api} />
          <BiblePanel sizeClass="normal" />
        </>,
      );
      const book = await enterReference();
      expect(useShow.getState().bibleSource?.tiles[0]?.lines).toEqual([
        `${numbers ? '16 ' : ''}Invented book 43, chapter 3, verse 16`,
      ]);
      expect(test.send).not.toHaveBeenCalled();
      act(() => selectTile(1));
      const user = userEvent.setup();
      await user.click(book);
      await user.keyboard('{Enter}');
      expect(test.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          position: 1,
          lines: [
            `${numbers ? '17 ' : ''}Invented book 43, chapter 3, verse 17`,
          ],
        },
      });
      view.unmount();
      expect(test.stop).toHaveBeenCalledOnce();
    },
  );

  it('takes changed defaults on the next lookup while retaining the prepared and live display', async () => {
    const test = fixture(false);
    window.llp = test.api;
    render(
      <>
        <BibleQuickField api={test.api} />
        <BiblePanel sizeClass="normal" />
      </>,
    );
    const book = await enterReference();
    act(() => selectTile(1));
    act(() => test.push(true));
    const user = userEvent.setup();
    await user.click(book);
    await user.keyboard('{Enter}');
    const command = test.send.mock.calls.at(-1)?.[0];
    if (command?.type !== 'slide.show') {
      throw new Error('Missing Bible output');
    }
    expect(command.slide.lines).toEqual([
      'Invented book 43, chapter 3, verse 17',
    ]);
    const live = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {...live, layers: {...live.layers, slide: command.slide}},
      }),
    );
    for (const end of ['17', '18']) {
      fireEvent.change(screen.getByRole('textbox', {name: '끝절'}), {
        target: {value: end},
      });
      await waitFor(() =>
        expect(useShow.getState().bibleSource?.passage.ref).toBe(
          `요한복음 3:16-${end}`,
        ),
      );
    }
    expect(useShow.getState().bibleSource?.verseNumbers).toBe(true);
    expect(useShow.getState().bibleSource?.id).not.toBe(command.slide.itemId);
    expect(test.send).toHaveBeenCalledOnce();
    act(() => revealLiveItem());
    act(() => outputPrevious());
    expect(test.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: command.slide.itemId,
        position: 0,
        lines: ['Invented book 43, chapter 3, verse 16'],
      },
    });
  });
});
