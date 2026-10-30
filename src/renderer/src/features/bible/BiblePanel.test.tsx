import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {Workspace} from '@renderer/app/shell/Workspace';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {
  useShow,
  openItem,
  revealLiveItem,
  selectTile,
} from '@renderer/features/presentation/state/show';
import {useLive} from '@renderer/platform/live';
import {emptyLiveState} from '@core/live/state';
import {seedSampleService} from '../presentation/testing/sampleService';
import {BibleQuickField} from '../quick/BibleQuickField';
import {BiblePanel} from './BiblePanel';
import {bibleDocument, panelApi, panelPassage} from './panelTesting';
import {openBiblePassage, showBiblePassage} from './actions';
import {lookupReply, lookupRequest} from './testBible';
import styles from './BiblePanel.module.css';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';

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
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
  seedSampleService();
});
afterEach(() => {
  cleanup();
  resetTooltips();
  delete window.llp;
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    openItemId: null,
  });
});

describe('Bible panel integration', () => {
  it('disables slide editing for a Bible preview without a prep handoff', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    render(<BiblePanel sizeClass="normal" />);
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const tile = within(grid).getAllByRole('option')[0];
    if (!tile) throw new Error('Missing Bible slide');
    fireEvent.contextMenu(tile);
    const edit = screen.getByRole('menuitem', {name: '슬라이드 편집'});
    expect(edit.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(edit))?.textContent).toBe(
      '이 슬라이드는 준비에서 편집할 수 없습니다',
    );
    fireEvent.click(edit);
    expect(screen.getByRole('menu', {name: '슬라이드'})).toBeTruthy();
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('allows all footer actions to wrap in a 560px panel', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    const style = document.createElement('style');
    const css = readFileSync(
      'src/renderer/src/features/bible/BiblePanel.module.css',
      'utf8',
    );
    style.textContent = css.replaceAll('.footer', `.${styles.footer}`);
    document.head.append(style);
    try {
      render(<BiblePanel sizeClass="normal" />);
      const footer = screen
        .getByRole('button', {name: '바로 띄우기'})
        .closest(`.${styles.footer}`);
      if (
        !(footer instanceof HTMLElement) ||
        !(footer.firstElementChild instanceof HTMLElement)
      ) {
        throw new Error('Missing Bible footer');
      }
      footer.style.width = '560px';
      expect(getComputedStyle(footer.firstElementChild).flexWrap).toBe('wrap');
      for (const name of [
        '예배 순서에 넣기',
        '앞 절 추가',
        '뒤 절 추가',
        '바로 띄우기',
      ]) {
        expect(within(footer).getByRole('button', {name})).toBeTruthy();
      }
    } finally {
      style.remove();
    }
  });
  it('cancels a deferred lookup when the already-open service row is selected again', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openItem('song-morning');
    let finish: (value: BibleLookupReply) => void = () => undefined;
    fixture.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
        mediaVisible={false}
      />,
    );
    const field = screen.getByRole<HTMLInputElement>('combobox', {
      name: '책',
    });
    await waitFor(() => expect(field.disabled).toBe(false));
    fireEvent.change(field, {target: {value: '요'}});
    await waitFor(() => expect(fixture.lookup).toHaveBeenCalledOnce());
    const service = screen.getByRole('region', {name: '예배 순서'});
    fireEvent.click(within(service).getByRole('option', {selected: true}));
    await act(async () => finish(lookupReply(lookupRequest())));
    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(screen.queryByRole('region', {name: '성경'})).toBeNull();
    expect(screen.getByRole('region', {name: '슬라이드'})).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).value,
    ).toBe('');
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('renders retained live A instead of preview B after reveal', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const passageA = panelPassage();
    openBiblePassage(passageA);
    selectTile(2);
    showBiblePassage(passageA);
    const sourceA = useShow.getState().bibleSource;
    if (sourceA === null) throw new Error('Missing live Bible fixture');
    const live = emptyLiveState();
    useLive.setState({
      state: {
        ...live,
        layers: {
          ...live.layers,
          slide: {
            itemId: sourceA.id,
            position: 2,
            label: '3:18',
            lines: [],
          },
        },
      },
    });
    openBiblePassage({
      ...passageA,
      ref: '창세기 1:1',
      displayRef: '창세기 1:1',
    });
    render(<BiblePanel sizeClass="normal" />);
    expect(screen.getByText('창세기 1:1')).toBeTruthy();
    act(() => revealLiveItem());
    expect(screen.getByText(passageA.displayRef)).toBeTruthy();
    expect(screen.queryByText('창세기 1:1')).toBeNull();
  });
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
        name: '책',
      });
      await waitFor(() => expect(field.disabled).toBe(false));
      fireEvent.change(field, {target: {value: '요'}});
      fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
        target: {value: '3'},
      });
      fireEvent.change(screen.getByRole('textbox', {name: '시작절'}), {
        target: {value: '16'},
      });
      fireEvent.change(screen.getByRole('textbox', {name: '끝절'}), {
        target: {value: '18'},
      });
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
    fireEvent.change(field, {target: {value: '요'}});
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
