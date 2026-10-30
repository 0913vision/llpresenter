import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LiveLayers} from '@core/live/state';
import {createMediaId} from '@core/schema/ids';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/state/show';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ItemPreviewPanel, ItemSettingsPanel} from './ItemSidePanels';
import {ServiceItemStore} from './serviceItemStore';
import {ServiceItemPanel} from './SongItemPanel';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {panelPassage} from '@renderer/features/bible/panelTesting';
import {editorPreviewFixture} from '@renderer/features/songs/editor/editorPreviewFixture';

const drawing = vi.hoisted(() => ({
  render: vi.fn<(layers: LiveLayers) => void>(),
}));
vi.mock('@renderer/render/outputRenderer', () => ({
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
  return {...fixture, editor, items, output, user: userEvent.setup()};
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

describe('service item preview and 항목 설정', () => {
  it('selects saved Bible verses by pointer and keyboard with local preview and no output', async () => {
    const {user, output, edits} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(within(grid).getAllByRole('option')).toHaveLength(3);
    expect(caption()).toContain('3:161 / 3');
    expect(lastLayers()?.slide?.lines).toEqual(['16 Invented verse 16']);
    await user.click(within(grid).getAllByRole('option')[2] ?? grid);
    expect(caption()).toContain('3:183 / 3');
    expect(lastLayers()?.slide?.lines).toEqual(['18 Invented verse 18']);
    await user.keyboard('{Home}{ArrowRight}');
    expect(caption()).toContain('3:172 / 3');
    expect(lastLayers()?.slide?.lines).toEqual(['17 Invented verse 17']);
    expect(screen.queryByRole('button', {name: '바로 띄우기'})).toBeNull();
    expect(output).not.toHaveBeenCalled();
    expect(edits).toHaveLength(0);
  });

  it('clamps a saved Bible selection after projection shrink and clears an unavailable preview', async () => {
    const {user, output, tiles} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    await user.click(within(grid).getAllByRole('option')[2] ?? grid);
    act(() =>
      useShow.setState({tiles: {[fixtureItems.arranged]: tiles.slice(0, 1)}}),
    );
    expect(within(grid).getAllByRole('option')).toHaveLength(1);
    expect(caption()).toContain('3:161 / 1');
    expect(lastLayers()?.slide?.lines).toEqual(['16 Invented verse 16']);
    act(() => useShow.setState({tiles: {}}));
    expect(within(grid).queryAllByRole('option')).toHaveLength(0);
    expect(caption()).toBe('미리보기');
    expect(output).not.toHaveBeenCalled();
  });

  it('starts another saved Bible item at its first tile and resets the old scroll position', async () => {
    const {output} = await setupBible();
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const viewport = grid.parentElement?.parentElement;
    if (!viewport) throw new Error('Missing Bible viewport');
    const initialScrollTop = viewport.scrollTop;
    viewport.scrollTop = 500;
    act(() => useShow.setState({openItemId: fixtureItems.plain}));
    await waitFor(() => expect(caption()).toContain('3:171 / 2'));
    const nextGrid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(nextGrid.parentElement?.parentElement?.scrollTop).toBe(
      initialScrollTop,
    );
    expect(
      within(nextGrid).getAllByRole('option')[0]?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(output).not.toHaveBeenCalled();
  });

  it('uses the selected preview screen and honors the current Look layer mask for Bible tiles', async () => {
    const {user, output, pushSettings} = await setupBible();
    await user.click(screen.getByRole('radio', {name: '방송 자막'}));
    expect(lastLayers()?.slide?.label).toBe('3:16');
    const {looks} = editorPreviewFixture();
    act(() =>
      pushSettings({
        ...looks,
        revision: 2,
        value: {
          ...looks.value,
          looks: looks.value.looks.map(look => ({...look, screens: {}})),
        },
      }),
    );
    expect(lastLayers()?.slide).toBeNull();
    act(() => pushSettings({...looks, revision: 3}));
    expect(lastLayers()?.slide?.label).toBe('3:16');
    expect(output).not.toHaveBeenCalled();
  });

  it('discards old Bible tiles while a different service is selected', async () => {
    const {output} = await setupBible();
    expect(caption()).toContain('1 / 3');
    act(() => useShow.setState({serviceId: 'other-service'}));
    await waitFor(() => expect(caption()).toBe('미리보기'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(output).not.toHaveBeenCalled();
  });

  it('previews the place selected in the item, in the order it plays', async () => {
    const {user, output} = await setup();
    expect(caption()).toContain('1절1 / 3');
    const strip = screen.getByRole('listbox', {name: '구성 순서'});
    await user.click(within(strip).getAllByRole('option')[2] ?? strip);
    expect(caption()).toContain('후렴3 / 3');
    expect(lastLayers()?.slide?.lines).toEqual(['빛을 따라가요']);
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
    expect(lastLayers()?.media?.mediaId).toBe(override);
  });

  it('names the source song and opens it in the editor', async () => {
    const {user, editor, first} = await setup();
    const settings = screen.getByRole('region', {name: '항목 설정'});
    const source = within(settings).getByRole('group', {name: '곡'});
    expect(source.textContent).toContain(first.song.title);
    expect(source.textContent).toContain('라이브러리');
    await user.click(
      within(source).getByRole('button', {name: '라이브러리 곡 열기'}),
    );
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
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
