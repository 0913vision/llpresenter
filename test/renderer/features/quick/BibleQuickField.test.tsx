import {
  beginQuickPassage,
  finishQuickPassage,
  canReturnFromQuickPassage,
} from '@renderer/session/show/quickReturn';
import {SlideGrid} from '@renderer/features/presentation/grid/SlideGrid';
import {handleShowKey} from '@renderer/features/presentation/keyboard/showKeys';
import {lastLiveCommand} from '@fixtures/renderer/session/liveCommands';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as v from 'valibot';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {translationIdSchema} from '@core/schema/common/ids';
import type {BibleLookupReply} from '@core/schema/bible/bibleLookup';
import {emptyLiveState} from '@core/schema/live/live';
import {bibleDocument, panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupReply, lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {shownText} from '@fixtures/core/liveSlide';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {openBiblePassage} from '@renderer/features/bible/passageActions';
import {BibleQuickField} from '@renderer/features/quick/BibleQuickField';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {commandBindingStore} from '@renderer/ui/keys/commandBindings';
import {useLive} from '@renderer/session/live';
import {
  openItem,
  outputSlideOf,
  returnFromQuickPassage,
} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/show/showOutput';
import {useShow} from '@renderer/session/show/showStore';

async function passage(input: string) {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid Bible passage fixture');
  return reply.result.value;
}

function songSlide() {
  const slide = outputSlideOf({itemId: 'song-morning', index: 1});
  if (slide === null) throw Error('Missing song slide');
  return slide;
}

async function book(): Promise<HTMLInputElement> {
  const field = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  await waitFor(() => expect(field.disabled).toBe(false));
  return field;
}

function openSource() {
  const view = useShow.getState();
  return bibleSourceFor(view, view.openItemId);
}

function currentRef(): string | undefined {
  return openSource()?.passage.ref;
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
  commandBindingStore.set({});
  window.removeEventListener('keydown', handleShowKey);
  delete window.llp;
});

describe('BibleQuickField', () => {
  it('outputs a quick passage with no AI request or indicator and keeps AI off after display changes', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const status = vi
      .spyOn(fixture.api.bible, 'getLlmStatus')
      .mockResolvedValue({
        status: 'ready',
        available: true,
        reason: '',
      });
    const subscribe = vi.spyOn(fixture.api.bible, 'onLlmStatus');
    const chooseBoundary = vi.spyOn(fixture.api.bible, 'chooseBoundary');
    render(
      <>
        <BibleQuickField api={fixture.api} />
        <BiblePanel sizeClass="normal" onProblem={() => undefined} />
      </>,
    );
    fireEvent.change(await book(), {target: {value: '요'}});
    fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
      target: {value: '3'},
    });
    const start = screen.getByRole('textbox', {name: '시작절'});
    fireEvent.change(start, {target: {value: '16'}});
    fireEvent.keyDown(start, {key: 'Enter', code: 'Enter'});
    await waitFor(() =>
      expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])?.type).toBe(
        'slide.show',
      ),
    );

    fireEvent.click(await screen.findByRole('checkbox', {name: '절 번호'}));
    expect(openSource()).toMatchObject({
      review: false,
      verseNumbers: false,
    });
    expect(status).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(chooseBoundary).not.toHaveBeenCalled();
    expect(screen.queryByText('AI 켜짐')).toBeNull();
  });

  it('starts a typed passage at its first verse, although another one of it is live', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const before = openBiblePassage(await passage('요한복음 3:16-18'));
    const live = outputSlideOf({itemId: before.id, index: 2});
    if (live === null) throw Error('Missing live verse');
    const state = emptyLiveState();
    useLive.setState({
      state: {...state, layers: {...state.layers, slide: live}},
    });
    render(
      <>
        <BibleQuickField api={fixture.api} />
        <SlideGrid columns={4} scalePercent={100} />
      </>,
    );
    fireEvent.change(await book(), {target: {value: '요'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '17'],
      ['끝절', '20'],
    ] as const) {
      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });
    }
    await waitFor(() => expect(currentRef()).toBe('요한복음 3:17-20'));
    await waitFor(() => expect(useShow.getState().selectedTile).toBe(1));
    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    await waitFor(() =>
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {position: 0, verse: {verse: 17}},
      }),
    );
  });

  it('selects a finder recent with arrows while keeping the book caret', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const settings = fixture.document();
    const translation = lookupRequest().translation;
    fixture.push({
      ...settings,
      revision: 2,
      value: {
        ...settings.value,
        recents: [
          {translation, ref: '요한복음 3:16'},
          {translation, ref: '요한복음 3:17'},
        ],
      },
    });
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {key: 'b', code: 'KeyB', ctrlKey: true});
    const field = await book();
    await screen.findByRole('button', {name: /3:17/});
    fireEvent.keyDown(field, {key: 'ArrowDown'});
    fireEvent.keyDown(field, {key: 'ArrowDown'});
    expect(document.activeElement).toBe(field);
    expect(
      screen
        .getByRole('button', {name: /3:17/})
        .getAttribute('data-highlighted'),
    ).toBe('true');
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() =>
      expect(fixture.lookup).toHaveBeenCalledWith({
        input: '요한복음 3:17',
        translation,
      }),
    );
  });
  it('shows and outputs the tenth recent with Alt+0', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const settings = fixture.document();
    fixture.push({
      ...settings,
      revision: 2,
      value: {
        ...settings.value,
        recents: Array.from({length: 10}, (_, index) => ({
          translation: lookupRequest().translation,
          ref: `요한복음 3:${index + 1}`,
        })),
      },
    });
    render(<BibleQuickField api={fixture.api} />);
    await book();
    expect(screen.queryByLabelText('최근 성경 구절')).toBeNull();
    fireEvent.keyDown(document.body, {key: '0', code: 'Digit0', altKey: true});
    expect(fixture.send).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, {key: 'b', code: 'KeyB', ctrlKey: true});
    const tenth = await screen.findByRole('button', {name: /요한복음 3:10/});
    expect(tenth.textContent).toContain('Alt0');
    fireEvent.keyDown(await book(), {key: '0', code: 'Digit0', altKey: true});
    await waitFor(() =>
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {title: '요한복음 3:10'},
      }),
    );
  });
  it('does not output a stale recent lookup after a newer pick', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    fixture.push({
      ...fixture.document(),
      revision: 2,
      value: {
        ...fixture.document().value,
        recents: [
          {translation: lookupRequest().translation, ref: '요한복음 3:16-18'},
          {translation: lookupRequest().translation, ref: '요한복음 3:16-19'},
        ],
      },
    });
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {key: 'b', code: 'KeyB', ctrlKey: true});
    await screen.findByRole('button', {name: /3:16~18/});
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {name: /요한복음 3:16~18/}),
    );
    fireEvent.click(screen.getByRole('button', {name: /요한복음 3:16~19/}));
    await waitFor(() =>
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {title: '요한복음 3:16~19'},
      }),
    );
    const count = fixture.send.mock.calls.length;
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음 3:16-18'))),
    );
    expect(fixture.send.mock.calls).toHaveLength(count);
  });
  it('does not output a finder recent after Escape dismisses it', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const ref = '요한복음 3:16-18';
    const settings = fixture.document();
    fixture.push({
      ...settings,
      revision: 2,
      value: {
        ...settings.value,
        recents: [{translation: lookupRequest().translation, ref}],
      },
    });
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {code: 'KeyB', key: 'b', ctrlKey: true});
    const dialog = screen.getByRole('dialog');
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    fireEvent.click(await screen.findByRole('button', {name: /3:16~18/}));
    fireEvent.keyDown(await book(), {key: 'Escape', code: 'Escape'});
    expect(dialog.isConnected).toBe(false);
    const count = fixture.send.mock.calls.length;
    await act(async () => finish(await formLookupReply(lookupRequest(ref))));
    expect(fixture.send.mock.calls).toHaveLength(count);
  });
  it('runs the configured recent shortcut only in the finder', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
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
    commandBindingStore.set({'bible.recent1': [{code: 'F8', mods: ['alt']}]});
    render(<BibleQuickField api={fixture.api} />);
    const field = await book();
    fireEvent.keyDown(field, {code: 'F8', key: 'F8', altKey: true});
    expect(fixture.send).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, {key: 'b', code: 'KeyB', ctrlKey: true});
    const recent = await screen.findByRole('button', {
      name: /요한복음 3:16~18/,
    });
    expect(recent.textContent).toContain('AltF8');
    fireEvent.keyDown(await book(), {code: 'F8', key: 'F8', altKey: true});
    await waitFor(() =>
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {title: '요한복음 3:16~18'},
      }),
    );
  });
  it.each([
    {code: 'KeyB', key: 'b', ctrlKey: true},
    {code: 'F8', key: 'F8', ctrlKey: false},
  ])('keeps the finder open and selects 책 on its binding again', async key => {
    if (key.code === 'F8') {
      commandBindingStore.set({'bible.focus': [{code: 'F8', mods: []}]});
    }
    const fixture = panelApi();
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, key);
    const dialog = screen.getByRole('dialog');
    const field = await book();
    fireEvent.change(field, {target: {value: 'abc'}});
    field.setSelectionRange(3, 3);
    fireEvent.keyDown(field, key);
    expect(dialog.isConnected).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 3]);
  });

  it('leaves text editing keys to the field even when bound to the finder', async () => {
    commandBindingStore.set({'bible.focus': [{code: 'Home', mods: ['ctrl']}]});
    const fixture = panelApi();
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {
      code: 'Home',
      key: 'Home',
      ctrlKey: true,
    });
    const dialog = screen.getByRole('dialog');
    const field = await book();
    const event = new KeyboardEvent('keydown', {
      code: 'Home',
      key: 'Home',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      field.dispatchEvent(event);
    });
    expect(dialog.isConnected).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('consumes a repeated binding without closing the finder', async () => {
    const fixture = panelApi();
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {code: 'KeyB', key: 'b', ctrlKey: true});
    const field = await book();
    const event = new KeyboardEvent('keydown', {
      code: 'KeyB',
      key: 'b',
      ctrlKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      field.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('leaves the finder open for input method keys', async () => {
    const fixture = panelApi();
    render(<BibleQuickField api={fixture.api} />);
    await book();
    fireEvent.keyDown(document.body, {code: 'KeyB', key: 'b', ctrlKey: true});
    const field = await book();
    fireEvent.keyDown(field, {
      code: 'KeyB',
      key: 'b',
      ctrlKey: true,
      isComposing: true,
    });
    fireEvent.keyDown(field, {code: 'KeyB', key: 'Process', ctrlKey: true});
    fireEvent.compositionStart(field);
    fireEvent.keyDown(field, {code: 'KeyB', key: 'b', ctrlKey: true});
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, {
      code: 'ControlRight',
      key: 'Control',
      ctrlKey: true,
    });
    fireEvent.keyDown(field, {code: 'KeyB', key: 'b', ctrlKey: true});
    fireEvent.keyUp(field, {code: 'ControlRight', key: 'Control'});
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does nothing when the preceding slide is missing or has been removed', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const bible = await passage('요한복음 3:16-18');
    beginQuickPassage();
    openBiblePassage(bible);
    finishQuickPassage();
    const quickId = useShow.getState().openItemId;
    if (quickId === null) throw Error('Missing quick passage');
    const quick = {itemId: quickId, position: 0, ...shownText('Quick')};
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: quick},
        },
      }),
    );
    expect(canReturnFromQuickPassage()).toBe(false);
    returnFromQuickPassage();
    expect(fixture.send).not.toHaveBeenCalled();
    const song = songSlide();
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: song},
        },
      }),
    );
    beginQuickPassage();
    openBiblePassage(bible);
    finishQuickPassage();
    act(() => {
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: quick},
        },
      });
      useShow.setState(view => ({
        rows: view.rows.filter(row => row.id !== 'song-morning'),
      }));
    });
    expect(canReturnFromQuickPassage()).toBe(false);
    returnFromQuickPassage();
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it.each(['enter', 'click'] as const)(
    'returns from quick %s output on Escape while text keeps Escape',
    async method => {
      const fixture = panelApi();
      window.llp = fixture.api;
      window.addEventListener('keydown', handleShowKey);
      openItem('song-morning');
      const before = songSlide();
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: before},
        },
      });
      render(
        <>
          <BibleQuickField api={fixture.api} />
          <SlideGrid columns={4} scalePercent={100} />
        </>,
      );
      fireEvent.change(await book(), {target: {value: '요'}});
      fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
        target: {value: '3'},
      });
      const start = screen.getByRole<HTMLInputElement>('textbox', {
        name: '시작절',
      });
      fireEvent.change(start, {target: {value: '16'}});
      start.focus();
      if (method === 'enter') {
        fireEvent.keyDown(start, {key: 'Enter', code: 'Enter'});
      } else {
        await waitFor(() => expect(currentRef()).toBe('요한복음 3:16'));
        fireEvent.click(await screen.findByRole('option', {name: /요3:16/}));
      }
      await waitFor(() =>
        expect(
          lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
        ).toMatchObject({
          type: 'slide.show',
          slide: {title: '요한복음 3:16'},
        }),
      );
      const shown = lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]);
      if (shown?.type !== 'slide.show') throw Error('Expected Bible output');
      act(() =>
        useLive.setState({
          state: {
            ...emptyLiveState(),
            layers: {...emptyLiveState().layers, slide: shown.slide},
          },
        }),
      );
      const beforeCount = fixture.send.mock.calls.length;
      start.focus();
      fireEvent.keyDown(start, {key: 'Escape', code: 'Escape'});
      expect(fixture.send.mock.calls).toHaveLength(beforeCount);
      const grid = screen.getByRole('listbox', {
        name: '슬라이드',
      });
      grid.focus();
      fireEvent.keyDown(grid, {key: 'Escape', code: 'Escape'});
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {itemId: 'song-morning', position: 1},
      });
      expect(useShow.getState().openItemId).toBe('song-morning');
    },
  );

  it.each(
    [
      ['book', '16', '', '요한복음 3:16'],
      ['end', '16', '18', '요한복음 3:16-18'],
      ['start', '16', '', '요한복음 3:16'],
      ['start', '16', '18', '요한복음 3:16-18'],
      ['chapter', '', '', '요한복음 3'],
    ].map(([part, start, end, expected]) => ({part, start, end, expected})),
  )(
    'outputs directly from $part with the selected range',
    async ({part, start, end, expected}) => {
      const fixture = panelApi();
      window.llp = fixture.api;
      render(
        <>
          <BibleQuickField api={fixture.api} />
          <SlideGrid columns={4} scalePercent={100} />
        </>,
      );
      fireEvent.change(await book(), {target: {value: '요'}});
      const chapter = screen.getByRole<HTMLInputElement>('textbox', {
        name: '장',
      });
      const startField = screen.getByRole<HTMLInputElement>('textbox', {
        name: '시작절',
      });
      const endField = screen.getByRole<HTMLInputElement>('textbox', {
        name: '끝절',
      });
      fireEvent.change(chapter, {target: {value: '3'}});
      if (start) fireEvent.change(startField, {target: {value: start}});
      if (end) fireEvent.change(endField, {target: {value: end}});
      const target =
        part === 'book'
          ? await book()
          : part === 'chapter'
            ? chapter
            : part === 'end'
              ? endField
              : startField;
      target.focus();
      fireEvent.keyDown(target, {key: 'Enter', code: 'Enter'});
      await waitFor(() =>
        expect(
          lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
        ).toMatchObject({
          type: 'slide.show',
          slide: {title: expected?.replace('-', '~'), position: 0},
        }),
      );
      expect(document.activeElement).toBe(
        screen.getByRole('listbox', {name: '슬라이드'}),
      );
    },
  );

  it('focuses the slide grid after Enter and ArrowRight outputs the next part', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    window.addEventListener('keydown', handleShowKey);
    render(
      <>
        <BibleQuickField api={fixture.api} />
        <SlideGrid columns={4} scalePercent={100} />
      </>,
    );
    const field = await book();
    fireEvent.change(field, {target: {value: '요'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '16'],
      ['끝절', '18'],
    ] as const) {
      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });
    }
    await waitFor(() => expect(currentRef()).toBe('요한복음 3:16-18'));
    const end = screen.getByRole<HTMLInputElement>('textbox', {
      name: '끝절',
    });
    end.focus();
    fireEvent.keyDown(end, {key: 'Enter', code: 'Enter'});
    const grid = screen.getByRole('listbox', {
      name: '슬라이드',
    });
    expect(document.activeElement).toBe(grid);
    expect(end.value).toBe('18');
    const shown = lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]);
    if (shown?.type !== 'slide.show') throw Error('Expected Bible output');
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLiveState().layers, slide: shown.slide},
        },
      }),
    );
    fireEvent.keyDown(grid, {key: 'ArrowRight', code: 'ArrowRight'});
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      type: 'slide.show',
      slide: {position: 1},
    });
  });

  it('keeps focus in an invalid reference field', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    render(
      <>
        <BibleQuickField api={fixture.api} />
        <SlideGrid columns={4} scalePercent={100} />
      </>,
    );
    const field = await book();
    field.focus();
    fireEvent.change(field, {target: {value: 'not-a-book'}});
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
    expect(document.activeElement).toBe(field);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('starts a new output request when a manual book edit starts', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const onIntent = vi.fn();
    render(<BibleQuickField api={fixture.api} onIntent={onIntent} />);
    const field = await book();
    const request = beginOutputRequest();
    const {commandVersion} = useLive.getState();

    fireEvent.change(field, {target: {value: '베'}});

    expect(isOutputRequestCurrent(request, commandVersion)).toBe(false);
    expect(onIntent).toHaveBeenCalled();
  });

  it('drops a pending lookup and clears itself when its selection version changes', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const view = render(
      <BibleQuickField api={fixture.api} selectionVersion={0} />,
    );
    fireEvent.change(await book(), {target: {value: '요'}});
    await waitFor(() => expect(fixture.lookup).toHaveBeenCalledOnce());

    view.rerender(<BibleQuickField api={fixture.api} selectionVersion={1} />);
    await act(async () => finish(lookupReply(lookupRequest())));

    expect(openSource()).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).value,
    ).toBe('');
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('drops an outstanding lookup after another item opens and releases its subscriptions', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const view = render(<BibleQuickField api={fixture.api} />);
    fireEvent.change(await book(), {target: {value: '요'}});

    act(() => openItem('song-morning'));
    await act(async () => finish(lookupReply(lookupRequest())));

    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.listenerCount()).toBe(1);
    view.unmount();
    expect(fixture.listenerCount()).toBe(0);
  });

  it('outputs a recent passage immediately when clicked', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
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
    const field = await book();
    fireEvent.change(field, {target: {value: '요'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '16'],
      ['끝절', '18'],
    ] as const) {
      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });
    }
    await waitFor(() => expect(currentRef()).toBe('요한복음 3:16-18'));
    expect(
      openSource()?.tiles.every(
        tile =>
          tile.slide.transition?.kind === 'wipe' &&
          tile.slide.transition.dir === 'left' &&
          tile.slide.transition.sec === 0.7,
      ),
    ).toBe(true);
    const typed = openSource();
    const grown = await passage('요한복음 3:16-19');
    act(() => {
      openBiblePassage(grown, {
        verseNumbers: typed?.verseNumbers ?? true,
        enteredRef: typed?.enteredRef ?? '요한복음 3:16-18',
        enteredTranslation:
          typed?.enteredTranslation ?? lookupRequest().translation,
      });
    });

    fireEvent.keyDown(document.body, {key: 'b', code: 'KeyB', ctrlKey: true});
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', {name: /요한복음 3:16~18/}));
    await waitFor(() =>
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {title: '요한복음 3:16~18'},
      }),
    );
  });

  it('outputs the shown passage with Enter, then goes back to the typed one on a manual edit', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    render(<BibleQuickField api={fixture.api} />);
    const field = await book();
    fireEvent.change(field, {target: {value: '요'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '16'],
      ['끝절', '18'],
    ] as const) {
      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });
    }
    await waitFor(() => expect(currentRef()).toBe('요한복음 3:16-18'));
    const typed = openSource();
    const shown = {
      ...(await passage('요한복음 3:16-19')),
      translation: v.parse(translationIdSchema, 'alternate'),
    };
    act(() => {
      openBiblePassage(shown, {
        verseNumbers: typed?.verseNumbers ?? true,
        enteredRef: typed?.enteredRef ?? '요한복음 3:16-18',
        enteredTranslation:
          typed?.enteredTranslation ?? lookupRequest().translation,
      });
    });

    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0])).toMatchObject({
      type: 'slide.show',
      slide: {title: '요한복음 3:16~19'},
    });
    fireEvent.change(field, {target: {value: '요한복음'}});

    expect(currentRef()).toBe('요한복음 3:16-18');
    expect(openSource()?.passage.translation).toBe(lookupRequest().translation);
  });

  it('logs an initial settings failure and lets go of a later one after unmount', async () => {
    const fixture = panelApi();
    const log = vi.spyOn(fixture.api.log, 'write');
    fixture.get.mockRejectedValueOnce(new Error('Invented settings failure'));
    const first = render(<BibleQuickField api={fixture.api} />);
    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'Could not load bible settings',
        }),
      ),
    );
    expect(screen.getByRole<HTMLInputElement>('combobox').disabled).toBe(true);
    first.unmount();
    let fail: (error: Error) => void = () => undefined;
    fixture.get.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const second = render(<BibleQuickField api={fixture.api} />);
    second.unmount();
    await act(async () => fail(new Error('Invented late failure')));
    expect(fixture.listenerCount()).toBe(0);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('retains newer pushed settings over the initial read', async () => {
    const fixture = panelApi();
    let finish: (value: ReturnType<typeof bibleDocument>) => void = () =>
      undefined;
    fixture.get.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const view = render(<BibleQuickField api={fixture.api} />);
    act(() =>
      fixture.push({
        ...bibleDocument(2),
        value: {...bibleDocument().value, translations: []},
      }),
    );
    await act(async () => finish(bibleDocument()));
    expect(screen.getByRole<HTMLInputElement>('combobox').disabled).toBe(false);
    view.unmount();
    expect(fixture.listenerCount()).toBe(0);
  });
});
