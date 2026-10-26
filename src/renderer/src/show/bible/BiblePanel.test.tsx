import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import {Workspace} from '@renderer/shell/Workspace';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useShow, openItem} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {emptyLiveState} from '@shared/live';
import {seedSampleService} from '../testing/sampleService';
import {BibleQuickField} from '../quick/BibleQuickField';
import {BiblePanel} from './BiblePanel';
import {bibleDocument, panelApi} from './panelTesting';
import {lookupReply, lookupRequest} from './testBible';

vi.mock('@renderer/show/PreviewPanel', () => ({PreviewPanel: () => null}));
vi.mock('@renderer/show/ShowMediaPanel', () => ({ShowMediaPanel: () => null}));
vi.mock('@renderer/show/ShowToolsPanel', () => ({ShowToolsPanel: () => null}));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShow.setState({
    bibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
  seedSampleService();
});
afterEach(() => {
  cleanup();
  delete window.llp;
  useShow.setState({bibleSource: null, openItemId: null});
});

describe('Bible panel integration', () => {
  it.each(['narrow', 'normal', 'wide'] as const)(
    'mounts the field and panel in the %s workspace and shares output/history',
    async sizeClass => {
      const fixture = panelApi();
      window.llp = fixture.api;
      render(
        <Workspace
          id="show"
          sizeClass={sizeClass}
          store={createMemoryColumnWidthStore()}
          mediaVisible={false}
        />,
      );
      const field = screen.getByRole<HTMLInputElement>('combobox', {
        name: '성경 구절',
      });
      await waitFor(() => expect(field.disabled).toBe(false));
      fireEvent.change(field, {target: {value: '요 3:16-18'}});
      const panel = await screen.findByRole('region', {name: '성경'});
      expect(within(panel).getByText('슬라이드 3개')).toBeTruthy();
      expect(fixture.send).not.toHaveBeenCalled();
      fireEvent.click(within(panel).getAllByRole('option')[1] ?? panel);
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {position: 1},
      });
      await waitFor(() =>
        expect(fixture.document().value.recents[0]?.ref).toBe(
          '요한복음 3:16-18',
        ),
      );
      fixture.send.mockClear();
      const user = userEvent.setup();
      await user.click(field);
      await user.keyboard('{Enter}');
      const entered = fixture.send.mock.calls.at(-1)?.[0];
      fixture.send.mockClear();
      await user.click(
        within(panel).getByRole('button', {name: '바로 띄우기'}),
      );
      expect(fixture.send.mock.calls.at(-1)?.[0]).toEqual(entered);
      const beforeSelection = fixture.send.mock.calls.length;
      fireEvent.click(screen.getByRole('option', {name: /아침이 밝아 오네/}));
      expect(fixture.send).toHaveBeenCalledTimes(beforeSelection);
      expect(screen.queryByRole('region', {name: '성경'})).toBeNull();
      expect(screen.getByRole('region', {name: '슬라이드'})).toBeTruthy();
    },
  );

  it('drops an outstanding lookup after service selection and releases subscriptions', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const view = render(
      <>
        <BibleQuickField api={fixture.api} />
        <BiblePanel sizeClass="normal" />
      </>,
    );
    const field = screen.getByRole<HTMLInputElement>('combobox');
    await waitFor(() => expect(field.disabled).toBe(false));
    fireEvent.change(field, {target: {value: '요 3:16'}});
    act(() => openItem('song-morning'));
    await act(async () => finish(lookupReply(lookupRequest())));
    expect(screen.queryByRole('region', {name: '성경'})).toBeNull();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.listenerCount()).toBe(1);
    view.unmount();
    expect(fixture.listenerCount()).toBe(0);
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
