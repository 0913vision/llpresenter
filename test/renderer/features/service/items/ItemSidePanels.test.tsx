import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
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
    <div data-testid="picture">{slide.lines.join(' ')}</div>
  ),
}));
afterEach(() =>
  useShow.setState({serviceId: null, openItemId: null, tiles: {}}),
);

it('keeps the first Bible picture while selecting slides locally and switching items', async () => {
  const f = itemFixture();
  const passage = panelPassage();
  const tiles = bibleVerseTiles(passage);
  const document = f.service();
  f.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(row =>
        row.id === fixtureItems.arranged || row.id === fixtureItems.plain
          ? {
              id: row.id,
              bible: {
                translation: passage.translation,
                ref: passage.ref,
                split: 'verse' as const,
                reference: 'every' as const,
                verseNumbers: true,
                translationName: false,
              },
            }
          : row,
      ),
    },
  });
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
    tiles: {
      [fixtureItems.arranged]: tiles,
      [fixtureItems.plain]: tiles.slice(1),
    },
  });
  const output = vi.spyOn(f.api.live, 'send');
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  function Panel() {
    const selected = useShow(view => view.openItemId);
    return (
      <DetailsPanel
        target={{
          kind: 'item',
          itemId:
            selected === fixtureItems.plain
              ? fixtureItems.plain
              : fixtureItems.arranged,
        }}
        api={f.api}
        editor={editor}
        items={items}
      />
    );
  }
  const view = render(<Panel />);
  try {
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.arranged),
    );
    const panel = screen.getByRole('region', {name: '세부정보'});
    expect(within(panel).getByTestId('picture').textContent).toContain(
      '16 Invented verse 16',
    );
    await userEvent.click(within(panel).getByRole('tab', {name: '슬라이드'}));
    const grid = within(panel).getByRole('listbox', {name: '슬라이드'});
    const options = within(grid).getAllByRole('option');
    if (options[2] === undefined) throw new Error('Missing third verse');
    await userEvent.click(options[2]);
    expect(items.getSnapshot().position).toBe(2);
    expect(within(panel).getAllByTestId('picture')[0]?.textContent).toContain(
      '16 Invented verse 16',
    );
    act(() => useShow.setState({openItemId: fixtureItems.plain}));
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.plain),
    );
    expect(
      screen.getByRole('tab', {name: '정보'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(items.getSnapshot().position).toBe(0);
    expect(output).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});
