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
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import type {GroupedSong} from '@shared/schema/groupedSong';
import {
  createServiceItemId,
  createSongGroupId,
  createSongId,
  type SongId,
} from '@shared/schema/ids';
import {emptyLiveState} from '@shared/live';
import {SongEditorStore} from '@renderer/prep/editor';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ServiceItemStore} from './serviceItemStore';
import {
  DEFAULT_ORDER_REASON,
  GROUPED_SONG_EDIT_REASON,
  NEWER_FILE_REASON,
} from './ItemArrangement';
import {ServiceItemPanel} from './SongItemPanel';

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
  await screen.findByRole('listbox', {name: '구성 순서'});
  await waitFor(() => expect(editor.getSnapshot().labels).not.toBeNull());
  const panel = screen.getByRole('region', {name: '예배 순서 항목'});
  return {...fixture, editor, items, panel, user: userEvent.setup()};
}

function strip(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole('listbox', {name: '구성 순서'});
}

function chips(panel: HTMLElement): string[] {
  return within(strip(panel))
    .getAllByRole('option')
    .map(chip => chip.textContent);
}

function chip(panel: HTMLElement, index: number): HTMLElement {
  const found = within(strip(panel)).getAllByRole('option')[index];
  if (found === undefined) throw new Error(`No chip ${index}`);
  return found;
}

function selectedThumbnail(panel: HTMLElement): number {
  const thumbnails = within(panel)
    .getAllByRole('option')
    .filter(option => option.closest('[aria-label="구성 순서"]') === null);
  return thumbnails.findIndex(
    option => option.getAttribute('aria-selected') === 'true',
  );
}

describe('service song item panel', () => {
  it('shows the song, the chosen 구성 as chips, and its thumbnails', async () => {
    const {panel, first} = await setup();
    expect(within(panel).getByText(first.song.title)).toBeDefined();
    expect(within(panel).getByText('슬라이드 3개')).toBeDefined();
    expect(
      within(panel).getByRole('button', {name: '구성'}).textContent,
    ).toContain('주일용');
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
  });

  it('selects the matching thumbnail with a chip, and a chip with a thumbnail', async () => {
    const {panel, user, edits} = await setup();
    await user.click(chip(panel, 2));
    expect(selectedThumbnail(panel)).toBe(2);
    await user.keyboard('{Home}');
    expect(selectedThumbnail(panel)).toBe(0);
    expect(edits).toEqual([]);
  });

  it('moves and removes positions of the 구성 in the song with Alt arrows and Delete', async () => {
    const {panel, user, documents, first, items} = await setup();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    expect(document.activeElement?.textContent).toBe('1절');
    await user.keyboard('{Delete}');
    expect(chips(panel)).toEqual(['후렴', '후렴']);
    await items.getSnapshot().song?.flush();
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [2, 2]},
    ]);
  });

  it('undoes and redoes chip edits in the song history with Ctrl Z and Ctrl Y', async () => {
    const {panel, user} = await setup();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    await user.keyboard('{Control>}z{/Control}');
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
    await user.keyboard('{Control>}y{/Control}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
  });

  it('moves selection and focus past a neighbor that is the same 슬라이드', async () => {
    const {panel, user, edits} = await setup();
    await user.click(chip(panel, 2));
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
    expect(selectedThumbnail(panel)).toBe(1);
    expect(document.activeElement).toBe(chip(panel, 1));
    expect(edits).toEqual([]);
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    expect(selectedThumbnail(panel)).toBe(0);
    expect(document.activeElement).toBe(chip(panel, 0));
  });

  it('leaves Ctrl Z to a text field in the panel', async () => {
    const {panel, user} = await setup();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    const size = within(panel).getByRole('spinbutton', {
      name: '슬라이드 크기 백분율',
    });
    await user.click(size);
    await user.keyboard('{Control>}z{/Control}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
  });

  it('drags a chip to a new place, and Esc cancels a drag', async () => {
    const {panel} = await setup();
    within(strip(panel))
      .getAllByRole('option')
      .forEach((option, index) => {
        vi.spyOn(option, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(index * 60, 0, 52, 30),
        );
      });
    const pointer = {pointerId: 7, button: 0};
    fireEvent.pointerDown(chip(panel, 0), {
      ...pointer,
      clientX: 10,
      clientY: 15,
    });
    fireEvent.pointerMove(window, {...pointer, clientX: 12, clientY: 15});
    expect(chip(panel, 0).getAttribute('data-dragging')).toBeNull();
    fireEvent.pointerMove(window, {...pointer, clientX: 200, clientY: 15});
    expect(chip(panel, 0).getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerUp(window, {...pointer, clientX: 200, clientY: 15});
    fireEvent.click(chip(panel, 0));
    expect(chips(panel)).toEqual(['후렴', '후렴', '1절']);
    expect(selectedThumbnail(panel)).toBe(2);
    fireEvent.pointerDown(chip(panel, 2), {
      ...pointer,
      clientX: 130,
      clientY: 15,
    });
    fireEvent.pointerMove(window, {...pointer, clientX: 0, clientY: 15});
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(chip(panel, 2).getAttribute('data-dragging')).toBeNull();
    fireEvent.pointerUp(window, {...pointer, clientX: 0, clientY: 15});
    expect(chips(panel)).toEqual(['후렴', '후렴', '1절']);
  });

  it('adds 새 구성 as a copy of the order and picks it for the item', async () => {
    mockMenuRowHeight();
    const {panel, user, service, documents, first} = await setup();
    await user.click(within(panel).getByRole('button', {name: '구성'}));
    await user.click(screen.getByRole('menuitem', {name: '새 구성'}));
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', {name: '예배 순서 항목'})).getByRole(
          'button',
          {name: '구성'},
        ).textContent,
      ).toContain('구성 1'),
    );
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [1, 2, 2]},
      {name: '구성 1', slides: [1, 2, 2]},
    ]);
    expect(service().service.order[1]).toMatchObject({arrangement: '구성 1'});
  });

  it('appends a chosen 슬라이드 from 슬라이드 넣기', async () => {
    mockMenuRowHeight();
    const {panel, user} = await setup();
    await user.click(
      within(panel).getByRole('button', {name: '슬라이드 넣기'}),
    );
    await user.click(screen.getByRole('menuitem', {name: /^1절 /u}));
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴', '1절']);
    expect(selectedThumbnail(panel)).toBe(3);
  });

  it('keeps the chips of 기본 read-only with the reason in a tooltip', async () => {
    const {panel, user, edits} = await setup(fixtureItems.plain);
    expect(chips(panel)).toEqual(['1절', '후렴']);
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}{Delete}');
    expect(chips(panel)).toEqual(['1절', '후렴']);
    expect((await hoverForTooltip(chip(panel, 0)))?.textContent).toBe(
      DEFAULT_ORDER_REASON,
    );
    expect(edits).toEqual([]);
  });

  it('chooses 기본 and a 구성 for this item only', async () => {
    mockMenuRowHeight();
    const {panel, user, service} = await setup();
    await user.click(within(panel).getByRole('button', {name: '구성'}));
    await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
    await waitFor(() => expect(chips(panel)).toEqual(['1절', '후렴']));
    expect(service().service.order[1]).not.toHaveProperty('arrangement');
  });

  it('locks the 구성 choice of a read-only service with the reason', async () => {
    const {panel, service, pushService} = await setup();
    act(() => pushService({...service(), revision: 9, access: 'readOnly'}));
    const choice = within(panel).getByRole('button', {name: '구성'});
    expect(choice.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(choice))?.textContent).toBe(
      NEWER_FILE_REASON,
    );
  });

  it('rings the chip of the live position of this item', async () => {
    const {panel} = await setup();
    const base = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {
          ...base,
          layers: {
            ...base.layers,
            slide: {
              itemId: fixtureItems.arranged,
              position: 2,
              label: '후렴',
              lines: ['빛을 따라가요'],
            },
          },
        },
      }),
    );
    const states = within(strip(panel))
      .getAllByRole('option')
      .map(option => option.getAttribute('data-state'));
    expect(states).toEqual([null, null, 'live']);
  });

  it('opens the source song in the editor', async () => {
    const {panel, user, editor, first} = await setup();
    await user.click(
      within(panel).getByRole('button', {name: '라이브러리 곡 편집'}),
    );
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
  });

  it('shows 0 slides and disables 라이브러리 곡 편집 for grouped song with empty named 구성', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const fixture = itemFixture();
    const g1Id = createSongGroupId('11111111-1111-4111-a111-111111111111');
    const songId = createSongId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: songId,
      title: '새 그룹 찬양',
      groups: [
        {
          id: g1Id,
          name: '1절',
          slides: [{lines: ['은혜로운 찬양']}],
        },
      ],
      arrangements: [{name: '빈 구성', groups: []}],
    };
    const document = {
      song: groupedSong,
      revision: 1,
      access: 'editable' as const,
    };
    const itemId = createServiceItemId('50000000-0000-4000-8000-000000000099');
    const currentService = fixture.service();
    const updatedService: ServiceDocument = {
      ...currentService,
      service: {
        ...currentService.service,
        order: [
          {
            id: itemId,
            song: document.song.id,
            arrangement: '빈 구성',
          },
        ],
      },
    };
    fixture.pushService(updatedService);

    const editor = new SongEditorStore(fixture.api, vi.fn());
    const session = new SongSession<GroupedSong>({
      document,
      api: fixture.api.content,
      changed: () => undefined,
      problem: () => undefined,
    });
    const testEditor = {
      sessionOf: (id: SongId) =>
        id === document.song.id ? session : editor.sessionOf(id),
      showItemSong: (id: SongId | null) => editor.showItemSong(id),
      attach: (doc: Parameters<typeof editor.attach>[0]) => editor.attach(doc),
      subscribe: (listener: () => void) => editor.subscribe(listener),
    };

    const items = new ServiceItemStore(fixture.api, testEditor, vi.fn());
    useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
    items.show({serviceId: fixtureServiceId, itemId});
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());

    const view = render(
      <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />,
    );
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
    });

    await screen.findByRole('listbox', {name: '구성 순서'});
    const panel = screen.getByRole('region', {name: '예배 순서 항목'});
    expect(within(panel).getByText('슬라이드 0개')).toBeDefined();
    expect(within(strip(panel)).queryAllByRole('option')).toHaveLength(0);

    const editBtn = within(panel).getByRole('button', {
      name: '라이브러리 곡 편집',
    });
    expect(editBtn.getAttribute('aria-disabled')).toBe('true');
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(editor.getSnapshot().session).toBeNull();
    expect((await hoverForTooltip(editBtn))?.textContent).toBe(
      GROUPED_SONG_EDIT_REASON,
    );
  });

  it('shows file-order thumbnails for a v1 song with an empty named 구성 (v1 regression test)', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const fixture = itemFixture();
    const v1Song = {
      ...fixture.first.song,
      arrangements: [{name: '빈 구성', slides: []}],
    };
    const document = {
      song: v1Song,
      revision: 1,
      access: 'editable' as const,
    };
    const itemId = createServiceItemId('50000000-0000-4000-8000-000000000098');
    const currentService = fixture.service();
    const updatedService: ServiceDocument = {
      ...currentService,
      service: {
        ...currentService.service,
        order: [
          {
            id: itemId,
            song: document.song.id,
            arrangement: '빈 구성',
          },
        ],
      },
    };
    fixture.pushService(updatedService);

    const editor = new SongEditorStore(fixture.api, vi.fn());
    const session = new SongSession({
      document,
      api: fixture.api.content,
      changed: () => undefined,
      problem: () => undefined,
    });
    const testEditor = {
      sessionOf: (id: SongId) =>
        id === document.song.id ? session : editor.sessionOf(id),
      showItemSong: (id: SongId | null) => editor.showItemSong(id),
      attach: (doc: Parameters<typeof editor.attach>[0]) => editor.attach(doc),
      subscribe: (listener: () => void) => editor.subscribe(listener),
    };

    const items = new ServiceItemStore(fixture.api, testEditor, vi.fn());
    useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
    items.show({serviceId: fixtureServiceId, itemId});
    await waitFor(() => expect(items.getSnapshot().song).not.toBeNull());

    const view = render(
      <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />,
    );
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
    });

    await screen.findByRole('listbox', {name: '구성 순서'});
    const panel = screen.getByRole('region', {name: '예배 순서 항목'});
    // NOTE(0913vision): v1 fallback: playbackOrder falls back to file order (2 slides).
    expect(within(panel).getByText('슬라이드 2개')).toBeDefined();
    expect(
      within(panel)
        .getAllByRole('option')
        .filter(opt => opt.closest('[aria-label="구성 순서"]') === null),
    ).toHaveLength(2);
  });

  it('shows an empty panel for nothing selected and for other kinds', async () => {
    await setup();
    const shownPanel = (): HTMLElement =>
      screen.getByRole('region', {name: '예배 순서 항목'});
    act(() => useShow.setState({openItemId: fixtureItems.slot}));
    expect(within(shownPanel()).queryByRole('listbox')).toBeNull();
    act(() => useShow.setState({openItemId: null}));
    expect(within(shownPanel()).queryByRole('listbox')).toBeNull();
  });
});
