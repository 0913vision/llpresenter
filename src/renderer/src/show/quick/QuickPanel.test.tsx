import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import {emptyLiveState} from '@shared/live';
import {Workspace} from '@renderer/shell/Workspace';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {openItem, useShow} from '@renderer/state/show';
import {seedSampleService} from '../testing/sampleService';
import {lookupReply, lookupRequest} from '../bible/testBible';
import {QuickPanel} from './QuickPanel';
import {
  deferred,
  quickDocument,
  quickFixture,
  quickId,
  quickLive,
} from './quickTesting';

vi.mock('@renderer/show/PreviewPanel', () => ({PreviewPanel: () => null}));
vi.mock('@renderer/show/ShowMediaPanel', () => ({ShowMediaPanel: () => null}));
vi.mock('@renderer/show/ShowToolsPanel', () => ({ShowToolsPanel: () => null}));
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
  seedSampleService();
});
afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('quick panel integration', () => {
  it.each(['mouse', 'keyboard'])(
    'cancels a pending song when a recent passage is chosen with %s',
    async method => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      const recent = lookupRequest('창세기 1:1');
      const document = fixture.document();
      fixture.push({
        ...document,
        value: {
          ...document.value,
          recents: [
            {
              ref: recent.input,
              translation: recent.translation,
            },
          ],
        },
      });
      const song = deferred<typeof fixture.song | null>();
      const passage = deferred<BibleLookupReply>();
      fixture.showSong.mockReturnValueOnce(song.promise);
      fixture.lookup.mockReturnValueOnce(passage.promise);
      render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
      fireEvent.click(await screen.findByRole('button', {name: '저장된 곡'}));
      const field = screen.getByRole<HTMLInputElement>('combobox');
      await waitFor(() => expect(field.disabled).toBe(false));
      fireEvent.focus(field);
      if (method === 'mouse') {
        fireEvent.click(screen.getByRole('option', {name: recent.input}));
      } else {
        fireEvent.keyDown(field, {key: 'ArrowDown'});
        fireEvent.keyDown(field, {key: 'Enter'});
      }
      await waitFor(() => expect(fixture.lookup).toHaveBeenCalledWith(recent));
      await act(async () => song.resolve(fixture.song));
      expect(fixture.send).not.toHaveBeenCalled();
      expect(useShow.getState().librarySong).toBeNull();
      expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe(
        recent.input,
      );
      await act(async () => passage.resolve(lookupReply(recent)));
      expect(useShow.getState().bibleSource?.passage.ref).toBe(recent.input);
      fireEvent.keyDown(screen.getByRole('combobox'), {key: 'Enter'});
      expect(fixture.send).toHaveBeenCalledOnce();
      expect(fixture.send.mock.calls[0]?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {position: 0},
      });
      await waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
    },
  );
  it.each(['narrow', 'normal', 'wide'] as const)(
    'mounts the persisted list in order in the %s workspace',
    async sizeClass => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      render(
        <Workspace
          id="show"
          sizeClass={sizeClass}
          store={createMemoryColumnWidthStore()}
          mediaVisible={false}
        />,
      );
      const panel = screen.getByRole('region', {name: '퀵 실행'});
      const list = within(panel).getByRole('group', {name: '퀵 실행 항목'});
      await waitFor(() =>
        expect(within(list).getAllByRole('button')).toHaveLength(7),
      );
      await waitFor(() =>
        expect(
          within(list)
            .getByRole('button', {name: /^시작 카운트다운/})
            .getAttribute('aria-disabled'),
        ).not.toBe('true'),
      );
      expect(
        within(list)
          .getAllByRole('button')
          .map(row => row.textContent),
      ).toEqual([
        '저장된 곡',
        '저장된 구절',
        '로고 화면',
        '시작 카운트다운1:30',
        '시작 매크로',
        '검은 화면',
        '새 버전 항목',
      ]);
      expect(
        within(panel).getByRole('combobox', {name: '성경 구절'}),
      ).toBeTruthy();
      expect(
        within(list)
          .getByRole('button', {name: '새 버전 항목'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      fireEvent.click(within(list).getByRole('button', {name: '검은 화면'}));
      fireEvent.click(within(list).getByRole('button', {name: '새 버전 항목'}));
      expect(fixture.send).not.toHaveBeenCalled();
      fireEvent.click(within(list).getByRole('button', {name: '시작 매크로'}));
      expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
        type: 'macro.run',
        macroId: quickId(105),
      });
    },
  );
  it('updates pressed states from main and turns only the chosen item off', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
    const prop = await screen.findByRole('button', {name: '로고 화면'});
    const timer = screen.getByRole('button', {name: /^시작 카운트다운/});
    await waitFor(() =>
      expect(timer.getAttribute('aria-disabled')).not.toBe('true'),
    );
    expect(prop.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(prop);
    fireEvent.click(timer);
    expect(fixture.send.mock.calls.map(([command]) => command)).toEqual([
      {type: 'prop.set', propId: quickId(103), on: true},
      {type: 'timer.start', timerId: quickId(104)},
    ]);
    expect(prop.getAttribute('aria-pressed')).toBe('false');
    const live = emptyLiveState();
    act(() => useLive.setState({state: quickLive()}));
    expect(prop.getAttribute('aria-pressed')).toBe('true');
    expect(timer.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(prop);
    fireEvent.click(timer);
    expect(
      fixture.send.mock.calls.slice(2).map(([command]) => command),
    ).toEqual([
      {type: 'prop.set', propId: quickId(103), on: false},
      {type: 'timer.reset', timerId: quickId(104)},
    ]);
    act(() => useLive.setState({state: live}));
    expect(prop.getAttribute('aria-pressed')).toBe('false');
    expect(timer.getAttribute('aria-pressed')).toBe('false');
  });
  it('drops a pending quick song when the already-open service row is selected again', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    openItem('song-morning');
    const song = deferred<typeof fixture.song | null>();
    fixture.showSong.mockReturnValueOnce(song.promise);
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
        mediaVisible={false}
      />,
    );
    fireEvent.click(await screen.findByRole('button', {name: '저장된 곡'}));
    const list = screen.getByRole('region', {name: '예배 순서'});
    fireEvent.click(within(list).getByRole('option', {selected: true}));
    await act(async () => song.resolve(fixture.song));
    expect(fixture.send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBe('song-morning');
  });
  it('drops an older Bible field lookup after a quick item is run', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    const reply = deferred<BibleLookupReply>();
    fixture.lookup.mockReturnValueOnce(reply.promise);
    render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
    const field = screen.getByRole<HTMLInputElement>('combobox');
    await waitFor(() => expect(field.disabled).toBe(false));
    fireEvent.change(field, {target: {value: '요 3:16'}});
    await waitFor(() => expect(fixture.lookup).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole('button', {name: '시작 매크로'}));
    await act(async () => reply.resolve(lookupReply(lookupRequest())));
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'macro.run',
      macroId: quickId(105),
    });
    expect(useShow.getState().bibleSource).toBeNull();
  });
  it.each(['typing', 'removed', 'unmount'])(
    'drops a pending song after %s',
    async action => {
      const fixture = quickFixture();
      window.llp = fixture.api;
      const song = deferred<typeof fixture.song | null>();
      fixture.showSong.mockReturnValueOnce(song.promise);
      const view = render(
        <QuickPanel selectionVersion={0} onProblem={vi.fn()} />,
      );
      fireEvent.click(await screen.findByRole('button', {name: '저장된 곡'}));
      if (action === 'typing') {
        fireEvent.change(screen.getByRole('combobox'), {
          target: {value: '요 3:'},
        });
      }
      if (action === 'removed') {
        const next = quickDocument(2);
        act(() =>
          fixture.pushQuick({...next, value: {...next.value, items: []}}),
        );
      }
      if (action === 'unmount') {
        view.unmount();
        expect(fixture.quickListeners()).toBe(0);
        expect(fixture.listenerCount()).toBe(0);
      }
      await act(async () => song.resolve(fixture.song));
      expect(fixture.send).not.toHaveBeenCalled();
      expect(useShow.getState().librarySong).toBeNull();
    },
  );
});
