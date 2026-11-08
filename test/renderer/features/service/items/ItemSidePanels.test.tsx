import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';
import {createMediaId} from '@core/schema/ids';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
  spyOnSongEditorWindow,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {
  ItemPreviewPanel,
  ItemSettingsPanel,
} from '@renderer/features/service/items/ItemSidePanels';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers, frame?: RenderFrame) => void>(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = drawing.render;
    dispose = vi.fn();
  },
}));

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null, tiles: {}});
  drawing.render.mockClear();
});

async function setup(
  itemId: string = fixtureItems.arranged,
  configure: (fixture: ReturnType<typeof itemFixture>) => void = () =>
    undefined,
) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  configure(fixture);
  const output = vi.spyOn(fixture.api.live, 'send');
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
  const view = render(
    <>
      <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />
      <ItemPreviewPanel items={items} editor={editor} />
      <ItemSettingsPanel items={items} editor={editor} />
    </>,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await waitFor(() => expect(items.getSnapshot().item?.id).toBe(itemId));
  if (items.getSnapshot().songStatus !== null) {
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  }
  await waitFor(() => expect(editor.getSnapshot().labels).not.toBeNull());
  const openWindow = spyOnSongEditorWindow(fixture.api);
  return {
    ...fixture,
    editor,
    items,
    output,
    openWindow,
    user: userEvent.setup(),
  };
}

async function setupBible() {
  const passage = panelPassage();
  const tiles = bibleVerseTiles(passage);
  const view = await setup(fixtureItems.arranged, fixture => {
    const document = fixture.service();
    fixture.pushService({
      ...document,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === fixtureItems.arranged || row.id === fixtureItems.plain
            ? {
                id: row.id,
                bible: {
                  translation: passage.translation,
                  ref:
                    row.id === fixtureItems.arranged
                      ? passage.ref
                      : '요한복음 3:17-18',
                  split: 'verse',
                  reference: 'every',
                  verseNumbers: true,
                  translationName: false,
                },
              }
            : row,
        ),
      },
    });
    useShow.setState({
      tiles: {
        [fixtureItems.arranged]: tiles,
        [fixtureItems.plain]: tiles.slice(1),
      },
    });
  });
  return {...view, tiles};
}

function caption(): string {
  const preview = screen.getByRole('region', {name: '미리보기'});
  return preview.textContent;
}

function lastLayers(): LiveLayers | undefined {
  return drawing.render.mock.calls.at(-1)?.[0];
}

function slideOption(grid: HTMLElement, index: number): HTMLElement {
  const found = within(grid).getAllByRole('option')[index];
  if (found === undefined) throw new Error(`No slide ${index}`);
  return found;
}

describe('service item preview and 항목 설정', () => {
  it('selects saved Bible verses by pointer and keyboard with local preview and no output', async () => {
    const {user, output, edits} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(within(grid).getAllByRole('option')).toHaveLength(3);
    expect(caption()).toContain('3:161 / 3');
    await waitFor(() =>
      expect(lastLayers()?.slide?.lines).toEqual(['16 Invented verse 16']),
    );
    expect(drawing.render.mock.lastCall?.[1]?.theme?.item?.title).toBe(
      panelPassage().ref,
    );
    expect(lastLayers()?.slide?.next).toEqual({
      label: '3:17',
      lines: ['17 Invented verse 17'],
    });
    await user.click(slideOption(grid, 2));
    expect(caption()).toContain('3:183 / 3');
    await waitFor(() =>
      expect(lastLayers()?.slide?.lines).toEqual(['18 Invented verse 18']),
    );
    expect(lastLayers()?.slide?.next).toBeUndefined();
    await user.keyboard('{ArrowLeft}');
    expect(caption()).toContain('3:172 / 3');
    await waitFor(() =>
      expect(lastLayers()?.slide).toMatchObject({
        lines: ['17 Invented verse 17'],
        next: {label: '3:18', lines: ['18 Invented verse 18']},
      }),
    );
    expect(screen.queryByRole('button', {name: '바로 띄우기'})).toBeNull();
    expect(output).not.toHaveBeenCalled();
    expect(edits).toHaveLength(0);
  });

  it('clamps a saved Bible selection after projection shrink and clears an unavailable preview', async () => {
    const {user, output, tiles} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    await user.click(slideOption(grid, 2));
    act(() =>
      useShow.setState({tiles: {[fixtureItems.arranged]: tiles.slice(0, 1)}}),
    );
    expect(within(grid).getAllByRole('option')).toHaveLength(1);
    expect(caption()).toContain('3:161 / 1');
    await waitFor(() =>
      expect(lastLayers()?.slide?.lines).toEqual(['16 Invented verse 16']),
    );
    act(() => useShow.setState({tiles: {}}));
    expect(within(grid).queryAllByRole('option')).toHaveLength(0);
    expect(caption().trim()).toBe('미리보기');
    expect(output).not.toHaveBeenCalled();
  });

  it('starts another saved Bible item at its first tile', async () => {
    const {user, output} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    await user.click(slideOption(grid, 1));
    act(() => useShow.setState({openItemId: fixtureItems.plain}));
    await waitFor(() => expect(caption()).toContain('3:171 / 2'));
    const nextGrid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(
      within(nextGrid).getAllByRole('option')[0]?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(output).not.toHaveBeenCalled();
  });

  it('discards old Bible tiles while a different service is selected', async () => {
    const {output} = await setupBible();
    expect(caption()).toContain('1 / 3');
    act(() => useShow.setState({serviceId: 'other-service'}));
    await waitFor(() => expect(caption().trim()).toBe('미리보기'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(output).not.toHaveBeenCalled();
  });

  it('draws the item background over the song default', async () => {
    const {items, service, pushService} = await setup();
    const override = createMediaId('60000000-0000-4000-8000-000000000001');
    act(() =>
      pushService({
        ...service(),
        revision: 9,
        service: {
          ...service().service,
          order: service().service.order.map(row =>
            row.id === fixtureItems.arranged
              ? {...row, background: override}
              : row,
          ),
        },
      }),
    );
    expect(items.getSnapshot().item).toMatchObject({background: override});
    await waitFor(() => expect(lastLayers()?.media?.mediaId).toBe(override));
  });

  it('names the source song and opens it in the 곡 편집 window', async () => {
    const {user, openWindow, first} = await setup();
    const settings = screen.getByRole('region', {name: '항목 설정'});
    const source = within(settings).getByRole('group', {name: '곡'});
    expect(source.textContent).toContain(first.song.title);
    expect(source.textContent).not.toContain('라이브러리');
    const usage = within(settings).getByRole('group', {name: '쓰는 곳'});
    expect(usage.textContent).toMatch(/예배 \d+곳/);
    await user.click(
      within(source).getByRole('button', {name: windowCommandLabels.editSong}),
    );
    expect(openWindow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({songId: first.song.id}),
    );
  });

  it('shows empty panels for a slot item', async () => {
    await setup();
    act(() => useShow.setState({openItemId: fixtureItems.slot}));
    const settings = screen.getByRole('region', {name: '항목 설정'});
    expect(within(settings).queryByRole('group')).toBeNull();
    expect(
      within(screen.getByRole('region', {name: '미리보기'})).queryByRole(
        'radiogroup',
      ),
    ).toBeNull();
  });
});
