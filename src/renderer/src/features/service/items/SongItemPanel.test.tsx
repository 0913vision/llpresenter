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
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {GroupedSong} from '@core/schema/groupedSong';
import {
  createServiceItemId,
  createSongGroupId,
  createSongId,
  type SongId,
} from '@core/schema/ids';
import {emptyLiveState} from '@core/live/state';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {mockMenuRowHeight} from '@renderer/features/songs/editor/editorTesting';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ServiceItemStore} from './serviceItemStore';
import {NEWER_FILE_REASON} from './ItemArrangement';
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
  it('keeps named arrangement chips selection-only and leaves source history untouched', async () => {
    const {panel, user, items, edits} = await setup();
    const session = items.getSnapshot().song;
    const before = session?.history.snapshot.song;
    const list = strip(panel);
    expect(list.getAttribute('aria-readonly')).toBe('true');
    expect(within(panel).queryByRole('button', {name: /넣기/})).toBeNull();
    expect(list.querySelector('[aria-hidden="true"]')).toBeNull();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}{Delete}');
    fireEvent.pointerDown(chip(panel, 0), {
      pointerId: 7,
      button: 0,
      clientX: 10,
    });
    fireEvent.pointerMove(window, {pointerId: 7, clientX: 400});
    fireEvent.pointerUp(window, {pointerId: 7, clientX: 400});
    expect(session?.history.snapshot.song).toBe(before);
    expect(edits).toEqual([]);
  });
  it('marks a missing named arrangement and follows its restoration without repairing the item', async () => {
    const {panel, first, pushSong, service, edits} = await setup();
    const missing = {
      ...first,
      revision: first.revision + 1,
      song: {...first.song, arrangements: []},
    };
    act(() => pushSong(missing));
    const reason = '‘주일용’ 구성이 없어 기본 구성을 사용합니다';
    expect(within(panel).getByRole('img', {name: reason})).toBeDefined();
    expect(
      within(panel)
        .getByRole('button', {name: '구성'})
        .getAttribute('aria-description'),
    ).toBe(reason);
    expect(chips(panel)).toEqual(['1절', '후렴']);
    expect(service().service.order[1]).toMatchObject({arrangement: '주일용'});
    expect(edits).toEqual([]);
    act(() => pushSong({...first, revision: missing.revision + 1}));
    expect(within(panel).queryByRole('img', {name: reason})).toBeNull();
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
    act(() => pushSong(missing));
    expect(within(panel).queryByRole('img', {name: reason})).toBeNull();
    expect(edits).toEqual([]);
  });

  it('repairs a missing arrangement only after an explicit choice of 기본', async () => {
    mockMenuRowHeight();
    const {panel, first, pushSong, user, service} = await setup();
    act(() =>
      pushSong({
        ...first,
        revision: first.revision + 1,
        song: {...first.song, arrangements: []},
      }),
    );
    const before = service().service.order;
    const choice = within(panel).getByRole('button', {name: '구성'});
    expect(choice.getAttribute('aria-description')).toBe(
      '‘주일용’ 구성이 없어 기본 구성을 사용합니다',
    );
    await user.click(choice);
    await user.keyboard('{Escape}');
    expect(service().service.order).toEqual(before);
    await user.click(choice);
    await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
    await waitFor(() =>
      expect(choice.getAttribute('aria-description')).toBeNull(),
    );
    const repaired = service().service.order[1];
    expect(repaired).not.toHaveProperty('arrangement');
    expect(repaired).toMatchObject({memo: '천천히', future: {keep: true}});
    expect(
      service().service.order.filter(item => item.id !== fixtureItems.arranged),
    ).toEqual(before.filter(item => item.id !== fixtureItems.arranged));
  });

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
    await user.click(chip(panel, 2));
    await user.click(within(panel).getByRole('button', {name: '곡 편집'}));
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
    expect(editor.getSnapshot().session?.history.snapshot.selection.block).toBe(
      1,
    );
    expect(editor.getSnapshot().session?.arrangement).toBe('주일용');
  });

  it.each([
    ['새 구성…', 'create-arrangement'],
    ['이름 바꾸기…', 'rename-arrangement'],
    ['구성 편집…', 'edit-arrangement'],
  ])(
    'opens the source editor for %s without changing the service',
    async (label, action) => {
      const {panel, user, editor, first, service, edits} = await setup();
      const before = service();
      await user.click(chip(panel, 2));
      await user.click(within(panel).getByRole('button', {name: '구성'}));
      await user.click(screen.getByRole('menuitem', {name: label}));
      expect(editor.getSnapshot().session?.document.song.id).toBe(
        first.song.id,
      );
      expect(
        editor.getSnapshot().session?.history.snapshot.selection.block,
      ).toBe(1);
      expect(editor.getSnapshot().actionRequest?.action).toBe(action);
      expect(service()).toBe(before);
      expect(edits).toEqual([]);
    },
  );

  it('uses the shared slide menu to hand off the clicked repeated slide and its key', async () => {
    const {panel, user, editor, service, edits} = await setup();
    const grid = within(panel).getByRole('listbox', {name: '슬라이드'});
    const third = within(grid).getAllByRole('option')[2];
    if (!third) throw new Error('Missing repeated thumbnail');
    fireEvent.contextMenu(third);
    expect(third.hasAttribute('data-menu-target')).toBe(true);
    await user.click(screen.getByRole('menuitem', {name: '단축키…'}));
    expect(editor.getSnapshot().session?.history.snapshot.selection.block).toBe(
      1,
    );
    expect(editor.getSnapshot().actionRequest?.action).toBe('hot-key');
    expect(service().service.order[1]).toMatchObject({arrangement: '주일용'});
    expect(edits).toEqual([]);
  });

  it('opens the source before deleting its named arrangement', async () => {
    const {panel, user, editor, first} = await setup();
    const remove = vi.spyOn(editor, 'deleteArrangement');
    await user.click(within(panel).getByRole('button', {name: '구성'}));
    await user.click(screen.getByRole('menuitem', {name: '지우기'}));
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
    expect(remove).toHaveBeenCalledExactlyOnceWith('주일용');
  });

  it('shows zero slides for an empty named group arrangement and enables library editing', async () => {
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
    expect(within(panel).getByText('슬라이드 0개')).toBeDefined();
    expect(within(strip(panel)).queryAllByRole('option')).toHaveLength(0);

    const editBtn = within(panel).getByRole('button', {
      name: '곡 편집',
    });
    expect(editBtn.getAttribute('aria-disabled')).not.toBe('true');
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(editor.getSnapshot().session?.document.song).toEqual(groupedSong);
  });

  it('keeps an empty named group arrangement empty after activation', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const fixture = itemFixture();
    const groupedEmpty = {
      ...fixture.first.song,
      arrangements: [{name: '빈 구성', groups: []}],
    };
    const document = {
      song: groupedEmpty,
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
    expect(within(panel).getByText('슬라이드 0개')).toBeDefined();
    expect(within(panel).queryByRole('img', {name: /구성이 없어/})).toBeNull();
    expect(
      within(panel)
        .queryAllByRole('option')
        .filter(opt => opt.closest('[aria-label="구성 순서"]') === null),
    ).toHaveLength(0);
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
