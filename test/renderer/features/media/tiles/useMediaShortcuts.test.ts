import {renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import type {MediaItem} from '@core/schema/media/mediaList';
import {useMediaShortcuts} from '@renderer/features/media/tiles/useMediaShortcuts';
import {commandBindingStore} from '@renderer/ui/keys/commandBindings';

const ITEM: MediaItem = {
  id: createMediaId('00000000-0000-4000-8000-0000000000c1'),
  name: '임재 배경',
  kind: 'image',
  file: 'presence.jpg',
  size: 1,
};

afterEach(() => {
  document.body.replaceChildren();
});

it.each(['prep', 'show'])(
  'deletes the selected media with Delete in the 미디어 grid of %s',
  workspace => {
    commandBindingStore.set({'edit.delete': [{code: 'Delete', mods: []}]});
    const layout = document.body.appendChild(document.createElement('div'));
    layout.setAttribute('data-workspace-layout', workspace);
    const view = layout.appendChild(document.createElement('section'));
    view.setAttribute('aria-label', '미디어 보기');
    const grid = view.appendChild(document.createElement('div'));
    grid.setAttribute('role', 'listbox');
    const tile = grid.appendChild(document.createElement('button'));
    tile.setAttribute('role', 'option');
    const remove = vi.fn();
    const {unmount} = renderHook(() =>
      useMediaShortcuts({
        title: '모든 미디어',
        selected: ITEM,
        reason: undefined,
        remove,
        duplicate: vi.fn(),
      }),
    );
    tile.focus();
    tile.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Delete',
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith(ITEM, tile);
    unmount();
  },
);
