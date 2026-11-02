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
