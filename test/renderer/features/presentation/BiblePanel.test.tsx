import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useShow, revealLiveItem, selectTile} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {ShownItemProvider} from '@renderer/session/shownItem';
import {emptyLiveState} from '@core/live/state';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {panelApi, panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {
  openBiblePassage,
  showBiblePassage,
} from '@renderer/features/bible/actions';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

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
  it('switches the grid A, B, A ahead of the deferred workspace frame', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const passageA = panelPassage();
    const passageB = {
      ...passageA,
      ref: '요한복음 4:16-18',
      displayRef: '요한복음 4:16-18',
      verses: passageA.verses.map(verse => ({
        ...verse,
        chapter: 4,
        text: `New passage ${verse.verse}`,
      })),
    };
    showBiblePassage(passageA);
    const first = useShow.getState().openItemId;
    render(
      <ShownItemProvider shownItem={first} trackLive>
        <BiblePanel sizeClass="normal" />
      </ShownItemProvider>,
    );
    const tiles = () =>
      within(screen.getByRole('listbox', {name: '슬라이드'}))
        .getAllByRole('option')
        .map(tile => tile.getAttribute('aria-label'));
    expect(tiles()[0]).toContain('Invented verse 16');
    act(() => showBiblePassage(passageB));
    expect(tiles()[0]).toContain('New passage 16');
    expect(tiles().some(label => label?.includes('Invented verse'))).toBe(
      false,
    );
    act(() => showBiblePassage(passageA));
    expect(tiles()[0]).toContain('Invented verse 16');
    expect(tiles().some(label => label?.includes('New passage'))).toBe(false);
    expect(fixture.send).toHaveBeenCalledTimes(3);
  });

  it('disables slide editing for a Bible preview without a prep handoff', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    render(<BiblePanel sizeClass="normal" />);
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const tile = within(grid).getAllByRole('option')[0];
    if (!tile) throw new Error('Missing Bible slide');
    const contextTarget = tile;
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    const edit = screen.getByRole('menuitem', {
      name: windowCommandLabels.editSong,
    });
    expect(edit.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(edit))?.textContent).toBe(
      '이 슬라이드는 준비에서 편집할 수 없습니다',
    );
    fireEvent.click(edit);
    expect(screen.getByRole('menu', {name: '슬라이드'})).toBeTruthy();
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
});
