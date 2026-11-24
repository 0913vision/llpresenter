import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/schema/live/live';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {panelApi, panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {openBiblePassage} from '@renderer/features/bible/passageActions';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {useShow} from '@renderer/session/show/showStore';

vi.mock('@renderer/features/presentation/preview/PreviewPanel', () => ({
  PreviewPanel: () => null,
}));
vi.mock('@renderer/features/tools/ShowToolsPanel', () => ({
  ShowToolsPanel: () => null,
}));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShow.setState({
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
    openItemId: null,
  });
});

describe('Bible panel integration', () => {
  it('places the slide zoom after the quick-passage actions in the shared footer', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    render(<BiblePanel sizeClass="normal" />);
    const zoom = screen.getByRole('slider', {name: '슬라이드 크기'});
    const footer = zoom.closest('footer');
    if (!footer) throw new Error('Missing grid footer');
    expect(within(footer).queryByText(/^\d+개$/u)).toBeNull();
    const next = within(footer).getByRole('button', {name: '뒤 절 추가'});
    expect(
      next.compareDocumentPosition(zoom) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      zoom.closest('[class*="footerEnd"]')?.lastElementChild?.contains(zoom),
    ).toBe(true);
  });
});
