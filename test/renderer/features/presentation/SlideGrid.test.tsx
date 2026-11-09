import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createMediaId} from '@core/schema/ids';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {applyService, openItem} from '@renderer/session/show';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {slidesItem, SLIDES_ITEM} from '@fixtures/core/slides';
import {projectSlides} from '@core/presentation/slides';
import type {LiveCommand} from '@core/live/commands';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';

beforeEach(() => {
  useLive.setState({state: null});
  seedSampleService();
  openItem('song-morning');
  window.llp = mockLlpApi();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

it('shows themed slides with ad names in their bands and sends picture slides on click', () => {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = mockLlpApi({live: {send}});
  const item = slidesItem();
  applyService({
    revision: 100,
    id: 'slides-service',
    name: 'Slides',
    readOnly: false,
    rows: [
      {id: SLIDES_ITEM, kind: 'slides', form: 'ad', title: item.slides.name},
    ],
    tiles: {[SLIDES_ITEM]: projectSlides(item)},
    jumpKeys: {},
  });
  openItem(SLIDES_ITEM);
  render(<SlideGrid columns={4} scalePercent={100} />);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.getAllByRole('option')[0]?.textContent).toContain('Meeting');
  fireEvent.click(slide(1));
  expect(screen.queryByRole('option', {selected: true})).toBeNull();
  const command = send.mock.calls.at(-1)?.[0];
  expect(command?.type).toBe('live.batch');
  if (command?.type !== 'live.batch') throw Error('Missing output batch');
  expect(command.commands.at(-1)).toMatchObject({
    type: 'slide.show',
    slide: {position: 1},
  });
});

function slide(index: number): HTMLElement {
  const tile = screen.getAllByRole('option')[index];
  if (!tile) throw new Error('Missing slide');
  return tile;
}

it('draws song thumbnails with the audience theme font and frame', () => {
  render(<SlideGrid columns={4} scalePercent={100} />);
  const text = slide(0).querySelector<HTMLElement>('[style*="font-size"]');
  expect(text?.style.fontSize).toBe('108px');
  expect(text?.style.fontFamily).toContain('NanumSquare');
  expect(text?.style.fontWeight).toBe('800');
  expect(slide(0).querySelector('svg[viewBox="0 0 1920 1080"]')).not.toBeNull();
});

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

it('shows the picture of a media tile, with the name in the band', () => {
  const media = createMediaId('6a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a41');
  applyService({
    revision: 1,
    id: 'service',
    name: '예배',
    readOnly: false,
    rows: [{kind: 'media', id: 'media-item', title: '카운트다운'}],
    tiles: {
      'media-item': [
        {
          label: null,
          labelColor: 'none',
          lines: ['카운트다운'],
          media: {mediaId: media, loop: true},
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
});

it('maps windowed clicks and menus to logical slide positions and keeps keyboard focus', () => {
  const send = vi.fn<(command: LiveCommand) => void>();
  const onOpenPrep = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  applyService({
    revision: 101,
    id: 'long-service',
    name: 'Long service',
    readOnly: false,
    rows: [{id: 'long-song', kind: 'song', title: 'Long song'}],
    tiles: {
      'long-song': Array.from({length: 100}, (_, index) => ({
        label: null,
        labelColor: 'none',
        lines: [`Slide ${index + 1}`],
      })),
    },
    jumpKeys: {},
  });
  openItem('long-song');
  const {container} = render(
    <SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />,
  );
  expect(screen.getAllByRole('option')).toHaveLength(16);
  const state = emptyLiveState();
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId: 'long-song',
            position: 15,
            label: null,
            lines: ['Slide 16'],
          },
        },
      },
    }),
  );
  const grid = screen.getByRole('listbox', {name: '슬라이드'});
  grid.focus();
  fireEvent.keyDown(grid, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(grid);
  expectOutput(send.mock.calls.at(-1)?.[0], 19);
  expect(screen.queryByRole('option', {selected: true})).toBeNull();
  fireEvent.scroll(container, {target: {scrollTop: 24}});
  const last = screen.getAllByRole('option').at(-1);
  if (!last) throw Error('Missing final slide');
  expect(last.getAttribute('aria-posinset')).toBe('100');
  expect(last.getAttribute('aria-setsize')).toBe('100');
  fireEvent.contextMenu(last);
  fireEvent.click(
    screen.getByRole('menuitem', {name: windowCommandLabels.editSong}),
  );
  expect(onOpenPrep).toHaveBeenCalledExactlyOnceWith('long-song', 99);
  fireEvent.click(last);
  const command = send.mock.calls.at(-1)?.[0];
  if (command?.type !== 'live.batch') throw Error('Missing output batch');
  expect(command.commands.at(-1)).toMatchObject({
    type: 'slide.show',
    slide: {position: 99},
  });
});

it('outputs one row from the live slide, leaves Enter inert, and targets right-click', () => {
  const send = vi.fn<(command: LiveCommand) => void>();
  const onOpenPrep = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        slide: {
          itemId: 'song-morning',
          position: 4,
          label: null,
          lines: ['Live'],
        },
      },
    },
  });
  render(<SlideGrid columns={4} scalePercent={100} onOpenPrep={onOpenPrep} />);
  const grid = screen.getByRole('listbox', {name: '슬라이드'});
  grid.focus();
  expect(document.activeElement).toBe(grid);
  expect(grid.tabIndex).toBe(0);
  expect(
    screen
      .getAllByRole('option')
      .every(
        tile =>
          tile.tabIndex === -1 &&
          tile.getAttribute('aria-selected') === 'false',
      ),
  ).toBe(true);
  fireEvent.keyDown(grid, {key: 'Enter'});
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(grid, {key: 'ArrowUp'});
  expectOutput(send.mock.calls.at(-1)?.[0], 0);
  fireEvent.contextMenu(slide(2));
  fireEvent.click(
    screen.getByRole('menuitem', {name: windowCommandLabels.editSong}),
  );
  expect(onOpenPrep).toHaveBeenCalledWith('song-morning', 2);
  expect(screen.queryByRole('option', {selected: true})).toBeNull();
});

function expectOutput(
  command: LiveCommand | undefined,
  position: number,
): void {
  if (command?.type !== 'live.batch') throw Error('Missing output batch');
  expect(command.commands.at(-1)).toMatchObject({
    type: 'slide.show',
    slide: {position},
  });
}
