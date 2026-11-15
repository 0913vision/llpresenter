import {handleShowKey} from '@renderer/features/presentation/shortcuts';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createMediaId} from '@core/schema/ids';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {applyService, openItem, useShow} from '@renderer/session/show';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeFile, themeScreens} from '@fixtures/core/themeOutput';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {slidesItem, SLIDES_ITEM} from '@fixtures/core/slides';
import {projectSlides} from '@core/presentation/slides';
import type {LiveCommand} from '@core/live/commands';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';

beforeEach(() => {
  window.addEventListener('keydown', handleShowKey);
  useLive.setState({state: null});
  seedSampleService();
  openItem('song-morning');
  window.llp = mockLlpApi();
});

afterEach(() => {
  window.removeEventListener('keydown', handleShowKey);
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
  expect(
    slide(0).querySelector(':scope > [class*="band"]')?.textContent,
  ).toContain('Meeting');
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

it('draws a sermon title tile with the sermon title theme and passage', async () => {
  const passage = panelPassage();
  const base = mockLlpApi();
  window.llp = mockLlpApi({
    settings: {
      get: request => {
        if (request.name === 'themes') {
          return Promise.resolve(settingsDocument('themes', themeFile()));
        }
        if (request.name === 'screens') {
          return Promise.resolve(
            settingsDocument('screens', {screens: themeScreens}),
          );
        }
        return base.settings.get(request);
      },
    },
  });
  applyService({
    revision: 1,
    id: 'sermon-service',
    name: 'Service',
    readOnly: false,
    rows: [
      {
        kind: 'bible',
        id: 'sermon',
        title: 'Sermon',
        sermonTitle: 'Sermon',
        bible: {
          translation: passage.translation,
          ref: passage.ref,
          sermonTitle: 'Sermon',
        },
      },
    ],
    tiles: {
      sermon: [
        {
          label: null,
          labelColor: 'none',
          lines: ['Sermon'],
          sermonTitle: true,
          reference: passage.displayRef,
        },
      ],
    },
    jumpKeys: {},
  });
  openItem('sermon');
  render(<SlideGrid columns={4} scalePercent={100} />);
  await waitFor(() =>
    expect(
      slide(0).querySelector('[data-kind="itemName"]')?.textContent,
    ).toContain(passage.ref.replace('-', '~')),
  );
  expect(
    slide(0).querySelector('[data-kind="currentText"]')?.textContent,
  ).toContain('Sermon');
});

it('shows a Bible verse label in the attached strip', () => {
  applyService({
    revision: 1,
    id: 'bible-service',
    name: '예배',
    readOnly: false,
    rows: [{kind: 'bible', id: 'bible-item', title: '요한복음'}],
    tiles: {
      'bible-item': [{label: '3:16', labelColor: 'none', lines: ['말씀']}],
    },
    jumpKeys: {},
  });
  openItem('bible-item');
  render(<SlideGrid columns={4} scalePercent={100} />);
  expect(
    slide(0).querySelector(':scope > [class*="band"]')?.textContent,
  ).toContain('3:16');
});

function slide(index: number): HTMLElement {
  const tile = screen.getAllByRole('option')[index];
  if (!tile) throw new Error('Missing slide');
  return tile;
}

it('draws song thumbnails through the audience output compositor', () => {
  render(<SlideGrid columns={4} scalePercent={100} />);
  const text = slide(0).querySelector<HTMLElement>('[data-kind="currentText"]');
  expect(text).not.toBeNull();
  const block = text?.querySelector<HTMLElement>('[style*="font-family"]');
  expect(block?.style.fontFamily).toContain('NanumSquare');
  expect(block?.style.fontWeight).toBe('800');
  expect(slide(0).querySelector('[data-layer="lyrics"]')).not.toBeNull();
  expect(slide(0).querySelector('svg[viewBox="0 0 1920 1080"]')).toBeNull();
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
  fireEvent.keyDown(grid, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(document.activeElement).toBe(grid);
  expectOutput(send.mock.calls.at(-1)?.[0], 16);
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

it('outputs the previous slide, leaves Enter inert, and targets right-click', () => {
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
  fireEvent.keyDown(grid, {key: 'ArrowUp', code: 'ArrowUp'});
  expectOutput(send.mock.calls.at(-1)?.[0], 3);
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

it('tracks the live index for Bible position after click and next output', () => {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = mockLlpApi({live: {send}});
  render(<SlideGrid columns={2} scalePercent={100} />);
  const publish = (position: number): void => {
    const state = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {
          ...state,
          layers: {
            ...state.layers,
            slide: {
              itemId: 'song-morning',
              position,
              label: null,
              lines: ['live'],
            },
          },
        },
      }),
    );
  };
  fireEvent.click(slide(1));
  expectOutput(send.mock.calls.at(-1)?.[0], 1);
  publish(1);
  expect(useShow.getState().selectedTile).toBe(1);
  fireEvent.keyDown(
    screen.getByRole('listbox', {name: '\uc2ac\ub77c\uc774\ub4dc'}),
    {key: 'ArrowDown', code: 'ArrowDown'},
  );
  expectOutput(send.mock.calls.at(-1)?.[0], 2);
  publish(2);
  expect(useShow.getState().selectedTile).toBe(2);
});

it('obeys slide boundaries and starts at the first slide on down when nothing is live', () => {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = mockLlpApi({live: {send}});
  render(<SlideGrid columns={3} scalePercent={100} />);
  const grid = screen.getByRole('listbox', {name: '\uc2ac\ub77c\uc774\ub4dc'});
  fireEvent.keyDown(grid, {key: 'ArrowUp', code: 'ArrowUp'});
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(grid, {key: 'ArrowDown', code: 'ArrowDown'});
  expectOutput(send.mock.calls.at(-1)?.[0], 0);
  const publish = (position: number): void => {
    const state = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {
          ...state,
          layers: {
            ...state.layers,
            slide: {
              itemId: 'song-morning',
              position,
              label: null,
              lines: ['live'],
            },
          },
        },
      }),
    );
  };
  publish(0);
  send.mockClear();
  fireEvent.keyDown(grid, {key: 'ArrowUp', code: 'ArrowUp'});
  expect(send).not.toHaveBeenCalled();
  publish(3);
  fireEvent.keyDown(grid, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(send).not.toHaveBeenCalled();
});

it('shows grid focus only after Tab entry, not pointer followed by arrows', () => {
  render(<SlideGrid columns={4} scalePercent={100} />);
  const grid = screen.getByRole('listbox', {name: '\uc2ac\ub77c\uc774\ub4dc'});
  const keeper = grid.parentElement?.parentElement;
  expect(keeper).not.toBeNull();
  fireEvent.pointerDown(slide(0));
  fireEvent.click(slide(0));
  expect(document.activeElement).toBe(grid);
  fireEvent.keyDown(grid, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(keeper?.getAttribute('data-tab-focus')).toBeNull();
  grid.blur();
  fireEvent.keyDown(document, {key: 'Tab'});
  fireEvent.focus(grid);
  expect(keeper?.getAttribute('data-tab-focus')).toBe('true');
  fireEvent.keyDown(grid, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(keeper?.getAttribute('data-tab-focus')).toBe('true');
  fireEvent.pointerDown(slide(0));
  expect(keeper?.getAttribute('data-tab-focus')).toBeNull();
});
