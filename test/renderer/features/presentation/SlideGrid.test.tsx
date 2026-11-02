import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {openItem} from '@renderer/session/show';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';

beforeEach(() => {
  seedSampleService();
  openItem('song-morning');
  window.llp = mockLlpApi();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

function slide(index: number): HTMLElement {
  const tile = screen.getAllByRole('option')[index];
  if (!tile) throw new Error('Missing slide');
  return tile;
}

it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
  'opens from $key and edits that slide without output',
  keys => {
    const onOpenPrep = vi.fn();
    const send = vi.fn();
    window.llp = mockLlpApi({live: {send}});
    render(
      <SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />,
    );
    const tile = slide(2);
    tile.focus();
    fireEvent.keyDown(tile, keys);
    fireEvent.click(
      screen.getByRole('menuitem', {name: windowCommandLabels.editSong}),
    );
    expect(onOpenPrep).toHaveBeenCalledExactlyOnceWith('song-morning', 2);
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  },
);

it('cannot edit the old item after the open item changes', () => {
  const onOpenPrep = vi.fn();
  render(<SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />);
  fireEvent.contextMenu(slide(0));
  act(() => openItem('song-river'));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(onOpenPrep).not.toHaveBeenCalled();
});
