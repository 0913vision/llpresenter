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
import {translationIdSchema} from '@core/schema/ids';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {emptyLiveState} from '@core/live/state';
import {bibleDocument, panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupReply, lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {openBiblePassage} from '@renderer/features/bible/actions';
import {BibleQuickField} from '@renderer/features/quick/BibleQuickField';
import {useLive} from '@renderer/session/live';
import {openItem, useShow} from '@renderer/session/show';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/showOutput';

async function passage(input: string) {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw Error('Invalid Bible passage fixture');
  return reply.result.value;
}

async function book(): Promise<HTMLInputElement> {
  const field = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  await waitFor(() => expect(field.disabled).toBe(false));
  return field;
}

function currentRef(): string | undefined {
  return useShow.getState().bibleSource?.passage.ref;
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
});

describe('BibleQuickField', () => {
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

    expect(useShow.getState().bibleSource).toBeNull();
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

  it('opens a reselected recent again over a grown preview and outputs it with Enter', async () => {
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
    const typed = useShow.getState().bibleSource;
    const grown = await passage('요한복음 3:16-19');
    act(() =>
      openBiblePassage(grown, {
        verseNumbers: typed?.verseNumbers ?? true,
        enteredRef: typed?.enteredRef ?? '요한복음 3:16-18',
        enteredTranslation:
          typed?.enteredTranslation ?? lookupRequest().translation,
      }),
    );

    fireEvent.focus(field);
    fireEvent.click(screen.getByRole('option', {name: /요한복음 3:16-18/}));
    expect(currentRef()).toBe('요한복음 3:16-18');
    fireEvent.keyDown(field, {key: 'Enter'});

    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'bible:sample:요한복음 3:16-18'},
    });
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
    const typed = useShow.getState().bibleSource;
    const shown = {
      ...(await passage('요한복음 3:16-19')),
      translation: v.parse(translationIdSchema, 'alternate'),
    };
    act(() =>
      openBiblePassage(shown, {
        verseNumbers: typed?.verseNumbers ?? true,
        enteredRef: typed?.enteredRef ?? '요한복음 3:16-18',
        enteredTranslation:
          typed?.enteredTranslation ?? lookupRequest().translation,
      }),
    );

    fireEvent.keyDown(screen.getByRole('textbox', {name: '끝절'}), {
      key: 'Enter',
    });
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'bible:alternate:요한복음 3:16-19'},
    });
    fireEvent.change(field, {target: {value: '요한복음'}});

    expect(currentRef()).toBe('요한복음 3:16-18');
    expect(useShow.getState().bibleSource?.passage.translation).toBe(
      lookupRequest().translation,
    );
  });

  it('logs an initial settings failure but ignores one delivered after unmount', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fixture = panelApi();
    fixture.get.mockRejectedValueOnce(new Error('Invented settings failure'));
    const first = render(<BibleQuickField api={fixture.api} />);
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(screen.getByRole<HTMLInputElement>('combobox').disabled).toBe(true);
    first.unmount();
    error.mockClear();
    let fail: (error: Error) => void = () => undefined;
    fixture.get.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const second = render(<BibleQuickField api={fixture.api} />);
    second.unmount();
    await act(async () => fail(new Error('Invented late failure')));
    expect(error).not.toHaveBeenCalled();
    expect(fixture.listenerCount()).toBe(0);
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
    expect(screen.getByRole<HTMLInputElement>('combobox').disabled).toBe(true);
    view.unmount();
    expect(fixture.listenerCount()).toBe(0);
  });
});
