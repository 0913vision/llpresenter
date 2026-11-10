import {act, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';

vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: ({
    slide,
  }: {
    slide: {position: number; lines: readonly string[]};
  }) => (
    <div data-testid="picture" data-position={slide.position}>
      {slide.lines.join(' ')}
    </div>
  ),
}));

it('keeps the first item slide in its picture when a different local slide is selected', async () => {
  const f = itemFixture();
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      sizeClass="normal"
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const picture = screen.getByTestId('picture');
    expect(picture.getAttribute('data-position')).toBe('0');
    act(() => items.selectPosition(1));
    expect(picture.getAttribute('data-position')).toBe('0');
    expect(picture.textContent).toContain(f.first.song.slides[0]?.lines[0]);
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
    useShow.setState({serviceId: null, openItemId: null});
  }
});
