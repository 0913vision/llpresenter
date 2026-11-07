import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createItemOverlayId} from '@core/schema/ids';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import {OverlayClips} from '@renderer/features/service/items/OverlayClip';
import type {OverlayControl} from '@renderer/features/service/items/useOverlayControl';
import type {OverlayEditing} from '@renderer/features/service/items/overlayEditing';

function setup(from = 5, to = 6) {
  const overlays: readonly ItemOverlay[] = [
    {
      id: createItemOverlayId('10000000-0000-4000-8000-000000000001'),
      name: 'Invented overlay',
      from,
      to,
      screens: [],
      content: {text: 'Overlay'},
    },
  ];
  let saved: readonly ItemOverlay[] = overlays;
  const change = vi.fn<OverlayEditing['change']>(async apply => {
    saved = apply(overlays);
    return true;
  });
  const control: OverlayControl = {
    editing: {
      overlays,
      count: 10,
      reason: undefined,
      screens: [],
      defaultScreens: [],
      media: [],
      change,
    },
    chosen: null,
    choose: vi.fn(),
    entries: () => [],
    dropMedia: vi.fn(),
    replaceContent: vi.fn(),
    remove: vi.fn(),
    dialog: null,
  };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const index = this.getAttribute('data-probe-tile');
      return index === null
        ? new DOMRect(0, 0, 200, 90)
        : new DOMRect(Number(index) * 100, 0, 90, 70);
    },
  );
  const view = render(
    <div>
      <button type="button" role="option" data-probe-tile="0">
        Five
      </button>
      <button type="button" role="option" data-probe-tile="1">
        Six
      </button>
      <OverlayClips control={control} positionOffset={4} />
    </div>,
  );
  return {view, change, saved: () => saved};
}

describe('overlay clips in a virtual song grid', () => {
  it('draws global endpoints against visible slides and writes a resized handle using the global offset', async () => {
    const {view, change, saved} = setup();
    expect(
      screen.getByRole('button', {
        name: 'Invented overlay, 슬라이드 5부터 6까지',
      }),
    ).toBeDefined();
    const handle = view.container.querySelector('[data-edge="from"]');
    if (handle === null) throw new Error('Missing handle');
    fireEvent.pointerDown(handle, {clientX: 0, clientY: 70, button: 0});
    fireEvent.pointerMove(document, {clientX: 150, clientY: 30});
    fireEvent.pointerUp(document);
    await waitFor(() => expect(change).toHaveBeenCalledOnce());
    expect(saved()[0]).toMatchObject({from: 6, to: 6});
  });
  it('shows continuation arrows without exposing handles for offscreen endpoints', () => {
    const {view} = setup(3, 8);
    const bar = screen.getByRole('button', {
      name: 'Invented overlay, 슬라이드 3부터 8까지',
    });
    expect(bar.textContent).toContain('‹');
    expect(bar.textContent).toContain('›');
    expect(view.container.querySelectorAll('[data-edge]')).toHaveLength(0);
  });
});
