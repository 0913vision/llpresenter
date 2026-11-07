import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';

import {SongEditorStore} from '@renderer/features/songs/editor';

import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
  spyOnSongEditorWindow,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';

import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null});
  useLive.setState({state: null});
  resetTooltips();
});

async function setup(itemId: string = fixtureItems.arranged) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
  const view = render(
    <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await screen.findByRole('listbox', {name: '슬라이드'});
  await waitFor(() => expect(editor.getSnapshot().labels).not.toBeNull());
  const panel = screen.getByRole('region', {name: '예배 순서 항목'});
  const openWindow = spyOnSongEditorWindow(fixture.api);
  return {
    ...fixture,
    editor,
    items,
    panel,
    openWindow,
    user: userEvent.setup(),
  };
}

function thumbnails(panel: HTMLElement) {
  return within(
    within(panel).getByRole('listbox', {name: '슬라이드'}),
  ).getAllByRole('option');
}

function secondThumbnail(panel: HTMLElement): HTMLElement {
  const tile = thumbnails(panel)[1];
  if (tile === undefined) throw new Error('Missing second slide');
  return tile;
}

describe('service song item panel', () => {
  it('shows the item slides and selects them without editing the library', async () => {
    const {panel, user, items, edits, first} = await setup();
    const tiles = thumbnails(panel);
    expect(tiles).toHaveLength(first.song.slides.length);
    await user.click(secondThumbnail(panel));
    expect(items.getSnapshot().position).toBe(1);
    expect(edits).toEqual([]);
    expect(within(panel).queryByRole('button', {name: '구성'})).toBeNull();
    expect(
      within(panel).queryByRole('listbox', {name: '구성 순서'}),
    ).toBeNull();
  });
  it('opens the item in the existing editor at the selected slide', async () => {
    const {panel, user, openWindow, first} = await setup();
    await user.click(secondThumbnail(panel));
    await user.click(
      within(panel).getByRole('button', {name: windowCommandLabels.editSong}),
    );
    expect(openWindow).toHaveBeenCalledExactlyOnceWith({
      songId: first.song.id,
      block: 1,
      from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
    });
  });
  it('keeps item lyrics when the library is edited', async () => {
    const {panel, first, pushSong} = await setup();
    const before = thumbnails(panel).map(tile => tile.textContent);
    act(() =>
      pushSong({
        ...first,
        revision: first.revision + 1,
        song: {
          ...first.song,
          slides: first.song.slides.map(slide => ({
            ...slide,
            lines: ['Changed library'],
          })),
        },
      }),
    );
    expect(thumbnails(panel).map(tile => tile.textContent)).toEqual(before);
  });
  it('hands the clicked slide to the hot key dialog without editing the service', async () => {
    const {panel, user, openWindow, edits} = await setup();
    fireEvent.contextMenu(secondThumbnail(panel));
    await user.click(screen.getByRole('menuitem', {name: '단축키…'}));
    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        block: 1,
        action: 'hot-key',
        from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      }),
    );
    expect(edits).toEqual([]);
  });
  it('disables editing when the service is read-only', async () => {
    const {panel, user, pushService, service, openWindow} = await setup();
    act(() =>
      pushService({
        ...service(),
        revision: service().revision + 1,
        access: 'readOnly',
      }),
    );
    const button = within(panel).getByRole('button', {
      name: windowCommandLabels.editSong,
    });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.click(button);
    expect(openWindow).not.toHaveBeenCalled();
  });
});
