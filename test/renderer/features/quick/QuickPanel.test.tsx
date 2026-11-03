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
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {openItem, useShow} from '@renderer/session/show';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {lookupReply, lookupRequest} from '@fixtures/core/bibleLookups';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {
  deferred,
  quickDocument,
  quickFixture,
  quickId,
  quickLive,
} from '@fixtures/renderer/features/tools/quickTesting';

vi.mock('@renderer/features/presentation/PreviewPanel', () => ({
  PreviewPanel: () => null,
}));
vi.mock('@renderer/features/tools/ShowToolsPanel', () => ({
  ShowToolsPanel: () => null,
}));
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
  useLive.setState({state: emptyLiveState(), lastStartedItemId: null});
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
      expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe('');
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
  it('shows the persisted list in order and leaves an unknown row disabled', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
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
    expect(within(panel).getByRole('combobox', {name: '책'})).toBeTruthy();
    expect(
      within(list)
        .getByRole('button', {name: '새 버전 항목'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(within(list).getByRole('button', {name: '새 버전 항목'}));
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('copies the focused row with Ctrl D through one handler for the whole list', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
    const panel = screen.getByRole('region', {name: '퀵 실행'});
    const list = within(panel).getByRole('group', {name: '퀵 실행 항목'});
    const row = await within(list).findByRole('button', {name: '검은 화면'});
    row.focus();
    fireEvent.keyDown(row, {key: 'd', code: 'KeyD', ctrlKey: true});
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
    expect(fixture.edit.mock.calls[0]?.[0]).toMatchObject({
      type: 'settings.update',
      name: 'quick',
    });
  });

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
  it('drops a pending quick song when its selection version changes', async () => {
    const fixture = quickFixture();
    window.llp = fixture.api;
    openItem('song-morning');
    const song = deferred<typeof fixture.song | null>();
    fixture.showSong.mockReturnValueOnce(song.promise);
    const view = render(
      <QuickPanel selectionVersion={0} onProblem={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', {name: '저장된 곡'}));

    view.rerender(<QuickPanel selectionVersion={1} onProblem={vi.fn()} />);
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
    fireEvent.change(field, {target: {value: '요'}});
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
