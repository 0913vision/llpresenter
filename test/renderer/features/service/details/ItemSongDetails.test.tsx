import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  SlidePicture: ({slide}: {slide: {lines: readonly string[]}}) => (
    <div>{slide.lines.join(' ')}</div>
  ),
}));

it('selects item slides locally, opens the clicked slide, and keeps its independent lyrics', async () => {
  const f = itemFixture();
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  const open = vi
    .spyOn(f.api.window, 'openSongEditor')
    .mockResolvedValue({ok: true, value: undefined});
  const output = vi.spyOn(f.api.live, 'send');
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    await userEvent.click(screen.getByRole('tab', {name: '슬라이드'}));
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const options = within(grid).getAllByRole('option');
    const second = options[1];
    if (second === undefined) throw new Error('Missing second slide');
    const before = options.map(option => option.textContent);
    await userEvent.click(second);
    expect(items.getSnapshot().position).toBe(1);
    expect(output).not.toHaveBeenCalled();
    await userEvent.dblClick(second);
    expect(open).toHaveBeenCalledWith({
      songId: f.first.song.id,
      block: 1,
      from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
    });
    act(() =>
      f.pushSong({
        ...f.first,
        revision: f.first.revision + 1,
        song: {
          ...f.first.song,
          slides: f.first.song.slides.map(slide => ({
            ...slide,
            lines: ['Changed library'],
          })),
        },
      }),
    );
    expect(
      within(grid)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(before);
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
    useShow.setState({serviceId: null, openItemId: null});
  }
});
