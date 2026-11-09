import type {MediaDocument} from '@core/schema/mediaEdit';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {
  mediaDocument,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';
import {isItemOfKind} from '@core/schema/service';

vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: ({slide}: {slide: {sectionCard?: {name: string}}}) => (
    <div data-testid="picture" data-card={slide.sectionCard?.name} />
  ),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));
afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null, tiles: {}});
});

it('shows the first picture and resets the tab and selection when the item changes', async () => {
  const f = itemFixture();
  const document = f.service();
  f.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(item =>
        item.id === fixtureItems.plain && isItemOfKind(item, 'song')
          ? {...item, slides: item.slides.slice(0, 1)}
          : item,
      ),
    },
  });
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      editor={editor}
      items={items}
    />,
  );
  try {
    const panel = screen.getByRole('region', {name: '세부정보'});
    await within(panel).findByText(
      `곡, 슬라이드 ${f.first.song.slides.length}개`,
    );
    expect(within(panel).getByTestId('picture')).toBeTruthy();
    await userEvent.click(within(panel).getByRole('tab', {name: '슬라이드'}));
    const options = within(panel).getAllByRole('option');
    if (options[1] === undefined) throw new Error('Expected two slides');
    await userEvent.click(options[1]);
    expect(items.getSnapshot().position).toBe(1);
    view.rerender(
      <DetailsPanel
        target={{kind: 'item', itemId: fixtureItems.plain}}
        api={f.api}
        editor={editor}
        items={items}
      />,
    );
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.plain),
    );
    expect(
      within(screen.getByRole('region', {name: '세부정보'}))
        .getByRole('tab', {name: '정보'})
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(items.getSnapshot().position).toBe(0);
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});
import {newSlidesItem} from '@core/services/slidesEdits';
import {createMediaId, createThemeId} from '@core/schema/ids';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';

it.each(['bible', 'ad', 'media', 'card'] as const)(
  'shows %s details and its slides tab',
  async kind => {
    const f = itemFixture();
    const passage = panelPassage();
    const document = f.service();
    const source = document.service.order.find(
      row => row.id === fixtureItems.arranged,
    );
    if (source === undefined || !isItemOfKind(source, 'song')) {
      throw new Error('Missing fixture song');
    }
    const item =
      kind === 'bible'
        ? {
            id: source.id,
            bible: {
              translation: passage.translation,
              ref: passage.ref,
              split: 'verse' as const,
              reference: 'every' as const,
              verseNumbers: true,
              translationName: false,
            },
          }
        : kind === 'ad'
          ? newSlidesItem('ad', source.id)
          : kind === 'media'
            ? {
                id: source.id,
                media: createMediaId('00000000-0000-4000-8000-000000000381'),
              }
            : {
                ...source,
                sectionCard: {
                  name: '찬양',
                  english: 'Praise',
                  theme: createThemeId('00000000-0000-4000-8000-000000000111'),
                },
              };
    f.pushService({
      ...document,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === source.id ? item : row,
        ),
      },
    });
    useShow.setState({serviceId: fixtureServiceId, openItemId: source.id});
    const editor = new SongEditorStore(f.api, vi.fn());
    const items = new ServiceItemStore(f.api, editor, vi.fn());
    const view = render(
      <DetailsPanel
        target={{kind: 'item', itemId: source.id}}
        api={f.api}
        editor={editor}
        items={items}
      />,
    );
    try {
      await waitFor(() => expect(items.getSnapshot().item?.id).toBe(source.id));
      const panel = screen.getByRole('region', {name: '세부정보'});
      const name =
        kind === 'bible'
          ? '성경'
          : kind === 'ad'
            ? '광고'
            : kind === 'media'
              ? '미디어'
              : '곡';
      await within(panel).findByText(new RegExp(`^${name}, 슬라이드`));
      if (kind === 'card') {
        expect(
          within(panel).getByTestId('picture').getAttribute('data-card'),
        ).toBe('찬양');
      }
      await userEvent.click(within(panel).getByRole('tab', {name: '슬라이드'}));
      expect(
        within(panel).getByRole('listbox', {name: '슬라이드'}),
      ).toBeTruthy();
    } finally {
      view.unmount();
      items.dispose();
      await editor.dispose();
    }
  },
);

it('edits a common transition and preserves differing per-slide transitions', async () => {
  const f = itemFixture();
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      editor={editor}
      items={items}
    />,
  );
  try {
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.arranged),
    );
    const button = await screen.findByRole('button', {name: '전환'});
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('menuitemradio', {name: '디졸브'}));
    await waitFor(() => {
      const item = f
        .service()
        .service.order.find(row => row.id === fixtureItems.arranged);
      expect(
        item &&
          isItemOfKind(item, 'song') &&
          item.slides.every(slide => slide.transition?.kind === 'dissolve'),
      ).toBe(true);
    });
    const current = f.service();
    const row = current.service.order.find(
      item => item.id === fixtureItems.arranged,
    );
    if (row === undefined || !isItemOfKind(row, 'song')) {
      throw new Error('Missing fixture');
    }
    f.pushService({
      ...current,
      revision: current.revision + 1,
      service: {
        ...current.service,
        order: current.service.order.map(item =>
          item.id === row.id
            ? {
                ...row,
                slides: row.slides.map((slide, index) =>
                  index === 0
                    ? {...slide, transition: {kind: 'none', sec: 0.5}}
                    : slide,
                ),
              }
            : item,
        ),
      },
    });
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '전환'})
          .getAttribute('aria-disabled'),
      ).toBe('true'),
    );
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('reports an editor opening failure through the item notice handler', async () => {
  const f = itemFixture();
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
  });
  vi.spyOn(f.api.window, 'openSongEditor').mockRejectedValue(
    new Error('failed'),
  );
  const report = vi.fn();
  const editor = new SongEditorStore(f.api, report);
  const items = new ServiceItemStore(f.api, editor, report);
  const view = render(
    <DetailsPanel
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      editor={editor}
      items={items}
    />,
  );
  try {
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.arranged),
    );
    await userEvent.click(screen.getByRole('tab', {name: '슬라이드'}));
    const first = screen.getAllByRole('option')[0];
    if (first === undefined) throw new Error('Missing first slide');
    await userEvent.dblClick(first);
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({key: 'details:editor', kind: 'warning'}),
      ),
    );
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('updates the media title when its source changes or disappears', async () => {
  const f = itemFixture();
  const document = f.service();
  const source = document.service.order.find(
    row => row.id === fixtureItems.arranged,
  );
  if (source === undefined) throw new Error('Missing fixture');
  f.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(row =>
        row.id === source.id ? {id: row.id, media: fixtureMedia.dawn} : row,
      ),
    },
  });
  let accept: (document: MediaDocument) => void = () => undefined;
  vi.spyOn(f.api.media, 'subscribe').mockImplementation(listener => {
    accept = listener;
    return () => undefined;
  });
  useShow.setState({serviceId: fixtureServiceId, openItemId: source.id});
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      target={{kind: 'item', itemId: source.id}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    await screen.findByTitle('새벽 하늘');
    act(() =>
      accept(
        mediaDocument(
          [{...mediaItem(2), id: fixtureMedia.dawn, name: 'Renamed'}],
          2,
        ),
      ),
    );
    expect(await screen.findByTitle('Renamed')).toBeTruthy();
    act(() => accept(mediaDocument([], 3)));
    await screen.findByTitle('미디어 없음');
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});
