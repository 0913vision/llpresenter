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
  SlidePicture: ({
    slide,
    screen,
  }: {
    slide: {sectionCard?: {name: string}; titleSlide?: boolean};
    screen?: {kind: string};
  }) => (
    <div
      data-testid="picture"
      data-card={slide.sectionCard?.name}
      data-title-slide={slide.titleSlide}
      data-screen={screen?.kind}
    />
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

it('switches the prepared picture to the chosen output screen', async () => {
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
      editor={editor}
      items={items}
    />,
  );
  try {
    await screen.findByTestId('picture');
    await userEvent.click(await screen.findByRole('radio', {name: '방송'}));
    await waitFor(() =>
      expect(screen.getByTestId('picture').getAttribute('data-screen')).toBe(
        'broadcast',
      ),
    );
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('preserves a song title slide in the prepared picture', async () => {
  const f = itemFixture();
  const document = f.service();
  f.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(item =>
        item.id === fixtureItems.arranged && isItemOfKind(item, 'song')
          ? {
              ...item,
              slides: item.slides.map((slide, index) =>
                index === 0 ? {...slide, titleSlide: true as const} : slide,
              ),
            }
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
      sizeClass="normal"
      target={{kind: 'item', itemId: fixtureItems.arranged}}
      api={f.api}
      editor={editor}
      items={items}
    />,
  );
  try {
    await waitFor(() =>
      expect(
        screen.getByTestId('picture').getAttribute('data-title-slide'),
      ).toBe('true'),
    );
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('updates the first picture when a section is chosen', async () => {
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
      editor={editor}
      items={items}
    />,
  );
  try {
    const field = await screen.findByRole('button', {name: '구역 이름'});
    expect(field.textContent).toContain('없음');
    await userEvent.click(field);
    await userEvent.click(screen.getByRole('menuitemradio', {name: '찬양'}));
    await waitFor(() =>
      expect(screen.getByTestId('picture').getAttribute('data-card')).toBe(
        '찬양',
      ),
    );
    expect(field.textContent).toContain('찬양');
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
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
      sizeClass="normal"
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
        sizeClass="normal"
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
import {
  createMediaId,
  createServiceItemId,
  createThemeId,
} from '@core/schema/ids';
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
        sizeClass="normal"
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

it('does not offer an item-level transition', async () => {
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
      editor={editor}
      items={items}
    />,
  );
  try {
    await waitFor(() =>
      expect(items.getSnapshot().item?.id).toBe(fixtureItems.arranged),
    );
    expect(screen.queryByRole('button', {name: '\uc804\ud658'})).toBeNull();
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
      sizeClass="normal"
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
      sizeClass="normal"
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

it('shows section item counts and restores item details when switching targets', async () => {
  const f = itemFixture();
  const document = f.service();
  const first = document.service.order.find(
    row => row.id === fixtureItems.arranged,
  );
  if (first === undefined) throw Error('Missing item');
  const section = {
    id: createServiceItemId('00000000-0000-4000-8000-000000000491'),
    header: '합심기도',
  };
  const empty = {
    id: createServiceItemId('00000000-0000-4000-8000-000000000492'),
    header: '빈 구역',
  };
  const next = {
    id: createServiceItemId('00000000-0000-4000-8000-000000000493'),
    header: '다음 구역',
  };
  f.pushService({
    ...document,
    service: {...document.service, order: [section, first, empty, next]},
  });
  useShow.setState({serviceId: fixtureServiceId, openItemId: section.id});
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const panelFor = (itemId: typeof section.id) => (
    <DetailsPanel
      sizeClass="normal"
      target={{kind: 'item', itemId}}
      api={f.api}
      items={items}
      editor={editor}
    />
  );
  const view = render(panelFor(section.id));
  const panel = () => screen.getByRole('region', {name: '세부정보'});
  const expectSection = async (name: string, count: number) => {
    await within(panel()).findByText(`구역, 항목 ${count}개`);
    expect(within(panel()).getByText(name)).toBeTruthy();
    expect(panel().textContent).toBe(`${name}구역, 항목 ${count}개`);
    expect(within(panel()).queryByRole('tablist')).toBeNull();
    expect(within(panel()).queryByTestId('picture')).toBeNull();
    expect(panel().querySelector('[class*="picture"]')).toBeNull();
    expect(within(panel()).queryByText(/슬라이드 0개/)).toBeNull();
  };
  try {
    await expectSection('합심기도', 1);
    view.rerender(panelFor(empty.id));
    await expectSection('빈 구역', 0);
    view.rerender(panelFor(first.id));
    await within(panel()).findByText(
      `곡, 슬라이드 ${f.first.song.slides.length}개`,
    );
    expect(within(panel()).getByTestId('picture')).toBeTruthy();
    expect(within(panel()).getByRole('tab', {name: '정보'})).toBeTruthy();
    expect(within(panel()).getByRole('tab', {name: '슬라이드'})).toBeTruthy();
    view.rerender(panelFor(section.id));
    await expectSection('합심기도', 1);
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('shows an empty panel without selection and restores it after an item is cleared', async () => {
  const f = itemFixture();
  useShow.setState({serviceId: fixtureServiceId, openItemId: null});
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const panelFor = (selected: boolean) => (
    <DetailsPanel
      sizeClass="normal"
      target={selected ? {kind: 'item', itemId: fixtureItems.arranged} : null}
      api={f.api}
      items={items}
      editor={editor}
    />
  );
  const view = render(panelFor(false));
  const panel = () => screen.getByRole('region', {name: '세부정보'});
  const expectEmpty = () => {
    expect(panel().textContent).toBe('');
    expect(within(panel()).queryByRole('tablist')).toBeNull();
    expect(within(panel()).queryByTestId('picture')).toBeNull();
    expect(panel().querySelector('[class*="picture"]')).toBeNull();
  };
  try {
    expectEmpty();
    view.rerender(panelFor(true));
    await within(panel()).findByText(
      `곡, 슬라이드 ${f.first.song.slides.length}개`,
    );
    expect(within(panel()).getByTestId('picture')).toBeTruthy();
    expect(within(panel()).getByRole('tab', {name: '정보'})).toBeTruthy();
    expect(within(panel()).getByRole('tab', {name: '슬라이드'})).toBeTruthy();
    view.rerender(panelFor(false));
    expectEmpty();
    await waitFor(() => expect(items.getSnapshot().item).toBeNull());
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('keeps the panel empty while an item loads and when the item is deleted', async () => {
  const f = itemFixture();
  const document = f.service();
  let release: ((value: typeof document) => void) | undefined;
  vi.spyOn(f.api.services, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
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
  const panel = () => screen.getByRole('region', {name: '세부정보'});
  const expectEmpty = () => {
    expect(panel().textContent).toBe('');
    expect(panel().querySelector('[class*="picture"]')).toBeNull();
    expect(within(panel()).queryByRole('tablist')).toBeNull();
  };
  try {
    expectEmpty();
    await waitFor(() => expect(release).toBeDefined());
    await act(async () => release?.(document));
    await within(panel()).findByText(
      `곡, 슬라이드 ${f.first.song.slides.length}개`,
    );
    expect(within(panel()).getByTestId('picture')).toBeTruthy();
    expect(within(panel()).getByRole('tab', {name: '정보'})).toBeTruthy();
    act(() =>
      f.pushService({
        ...document,
        revision: document.revision + 1,
        service: {
          ...document.service,
          order: document.service.order.filter(
            row => row.id !== fixtureItems.arranged,
          ),
        },
      }),
    );
    await waitFor(() => expect(items.getSnapshot().item).toBeNull());
    expectEmpty();
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('keeps the panel empty while a library song loads', async () => {
  const f = itemFixture();
  const result = {
    songId: f.first.song.id,
    songRevision: f.first.revision,
    title: f.first.song.title,
    readOnly: false,
    tiles: f.first.song.slides.map(slide => ({
      label: slide.label ?? null,
      labelColor: 'none' as const,
      lines: slide.lines,
    })),
    jumpKeys: {},
  };
  let release: ((value: typeof result) => void) | undefined;
  vi.spyOn(f.api.library, 'showSong').mockImplementation(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const editor = new SongEditorStore(f.api, vi.fn());
  const items = new ServiceItemStore(f.api, editor, vi.fn());
  const view = render(
    <DetailsPanel
      sizeClass="normal"
      target={{kind: 'song', songId: f.first.song.id}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    const panel = screen.getByRole('region', {name: '세부정보'});
    expect(panel.textContent).toBe('');
    expect(panel.querySelector('[class*="picture"]')).toBeNull();
    expect(within(panel).queryByRole('tablist')).toBeNull();
    await act(async () => release?.(result));
    await within(panel).findByText(`곡, 슬라이드 ${result.tiles.length}개`);
    expect(within(panel).getByRole('tab', {name: '정보'})).toBeTruthy();
    expect(within(panel).getByRole('tab', {name: '슬라이드'})).toBeTruthy();
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('shows a notice when the selected library song cannot load', async () => {
  const f = itemFixture();
  vi.spyOn(f.api.library, 'showSong').mockRejectedValue(new Error('failed'));
  const report = vi.fn();
  const editor = new SongEditorStore(f.api, report);
  const items = new ServiceItemStore(f.api, editor, report);
  const view = render(
    <DetailsPanel
      sizeClass="normal"
      target={{kind: 'song', songId: f.first.song.id}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'details:library',
          kind: 'warning',
          title: '곡 불러오기 실패',
        }),
      ),
    );
    expect(screen.getByRole('region', {name: '세부정보'}).textContent).toBe('');
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});

it('does not report a failed library request after the target changes', async () => {
  const f = itemFixture();
  let reject: ((reason: Error) => void) | undefined;
  vi.spyOn(f.api.library, 'showSong').mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const report = vi.fn();
  const editor = new SongEditorStore(f.api, report);
  const items = new ServiceItemStore(f.api, editor, report);
  const view = render(
    <DetailsPanel
      sizeClass="normal"
      target={{kind: 'song', songId: f.first.song.id}}
      api={f.api}
      items={items}
      editor={editor}
    />,
  );
  try {
    await waitFor(() => expect(reject).toBeDefined());
    view.rerender(
      <DetailsPanel
        sizeClass="normal"
        target={null}
        api={f.api}
        items={items}
        editor={editor}
      />,
    );
    await act(async () => reject?.(new Error('failed')));
    expect(report).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    items.dispose();
    await editor.dispose();
  }
});
