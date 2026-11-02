import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createMediaId, createNoticeSetId} from '@core/schema/ids';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {applyService, openItem} from '@renderer/session/show';
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

it('shows the picture of a media tile and of each 공지 image, with the name in the band', () => {
  const media = createMediaId('6a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a41');
  const image = createMediaId('6a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a42');
  applyService({
    revision: 1,
    id: 'service',
    name: '예배',
    readOnly: false,
    rows: [
      {kind: 'media', id: 'media-item', title: '카운트다운'},
      {kind: 'notice', id: 'notice-item', title: '주일 광고'},
    ],
    tiles: {
      'media-item': [
        {
          label: null,
          labelColor: 'none',
          lines: ['카운트다운'],
          media: {mediaId: media, loop: true},
        },
      ],
      'notice-item': [
        {
          label: null,
          labelColor: 'none',
          lines: ['광고 1'],
          notice: {
            noticeId: createNoticeSetId('5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f'),
            position: 0,
            media: image,
          },
        },
      ],
    },
    jumpKeys: {},
  });
  openItem('media-item');
  const {container} = render(<SlideGrid columns={4} scalePercent={100} />);
  expect(slide(0).getAttribute('aria-label')).toContain('카운트다운');
  expect(container.querySelector('img')?.getAttribute('src')).toBe(
    thumbnailUrl(media),
  );
  act(() => openItem('notice-item'));
  expect(slide(0).getAttribute('aria-label')).toContain('광고 1');
  expect(container.querySelector('img')?.getAttribute('src')).toBe(
    thumbnailUrl(image),
  );
});
