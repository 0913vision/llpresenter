import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  createServiceItemId,
  createSongGroupId,
  createSongId,
  type SongId,
} from '@shared/schema/ids';
import type {GroupedSong} from '@shared/schema/groupedSong';
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import {SongEditorStore} from '@renderer/prep/editor';
import {SongSession} from '@renderer/prep/editor/songSession';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {fixtureServiceId, itemFixture} from './itemFixture';
import {ServiceItemStore} from './serviceItemStore';
import {
  DEFAULT_ORDER_REASON,
  ItemArrangement,
  NEWER_FILE_REASON,
} from './ItemArrangement';

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null});
  useLive.setState({state: null});
  resetTooltips();
});

function createTestGroupedSong(
  unnamed = false,
  readOnly = false,
  danglingFirst = false,
) {
  const g1Id = createSongGroupId('11111111-1111-4111-a111-111111111111');
  const g2Id = createSongGroupId('22222222-2222-4222-a222-222222222222');
  const g3Id = createSongGroupId('33333333-3333-4333-a333-333333333333');
  const danglingId = createSongGroupId('99999999-9999-4999-a999-999999999999');
  const songId = createSongId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab');

  const song: GroupedSong = {
    format: 'llsong',
    schemaVersion: 2,
    id: songId,
    title: '그룹 찬송가',
    groups: [
      {
        id: g1Id,
        name: unnamed ? '' : '1절',
        slides: [
          {lines: ['1절 첫째 줄', '1절 둘째 줄']},
          {lines: ['1절 셋째 줄']},
        ],
      },
      {
        id: g2Id,
        name: unnamed ? '' : '후렴',
        slides: [{lines: ['후렴 첫째 줄']}],
      },
      {
        id: g3Id,
        name: '',
        slides: [{lines: ['아멘']}],
      },
    ],
    arrangements: [
      {
        name: '주일용',
        groups: danglingFirst
          ? [danglingId, g1Id, g2Id, g1Id]
          : [g1Id, g2Id, g1Id],
      },
      {
        name: '빈 구성',
        groups: [],
      },
    ],
  };

  return {
    document: {
      song,
      revision: 1,
      access: readOnly ? ('readOnly' as const) : ('editable' as const),
    },
    g1Id,
    g2Id,
    g3Id,
  };
}

async function setupGrouped(
  options: {
    unnamed?: boolean;
    readOnly?: boolean;
    arrangement?: string | undefined;
    danglingFirst?: boolean;
  } = {},
) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const {document, g1Id, g2Id, g3Id} = createTestGroupedSong(
    options.unnamed,
    options.readOnly,
    options.danglingFirst,
  );

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
          arrangement:
            'arrangement' in options ? options.arrangement : '주일용',
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

  const onSelect = vi.fn();
  const labels = [
    {name: '1절', color: 'teal' as const, key: null},
    {name: '후렴', color: 'orange' as const, key: null},
  ];

  const view = render(
    <ItemArrangement
      items={items}
      session={session}
      itemId={itemId}
      labels={labels}
      selected={0}
      onSelect={onSelect}
    />,
  );

  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });

  await screen.findByRole('listbox', {name: '구성 순서'});
  return {
    ...fixture,
    editor,
    items,
    session,
    itemId,
    g1Id,
    g2Id,
    g3Id,
    onSelect,
    user: userEvent.setup(),
  };
}

describe('ItemArrangement with grouped songs', () => {
  it.each([false, true])(
    'identifies a missing group arrangement with song readOnly=%s',
    async readOnly => {
      const {service, edits} = await setupGrouped({
        arrangement: '없는 구성',
        readOnly,
      });
      const reason = '‘없는 구성’ 구성이 없어 기본 구성을 사용합니다';
      const warning = screen.getByRole('img', {name: reason});
      expect(screen.getByRole('button', {name: '구성'}).textContent).toBe(
        '기본',
      );
      expect(
        within(screen.getByRole('listbox', {name: '구성 순서'})).getAllByRole(
          'option',
        ),
      ).toHaveLength(3);
      expect(service().service.order[0]).toMatchObject({
        arrangement: '없는 구성',
      });
      expect(edits).toEqual([]);
      expect((await hoverForTooltip(warning))?.textContent).toBe(reason);
    },
  );

  it('renders one chip per group occurrence and colors chips by label', async () => {
    await setupGrouped();
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');
    expect(chips).toHaveLength(3);
    expect(chips[0]?.textContent).toBe('1절');
    expect(chips[1]?.textContent).toBe('후렴');
    expect(chips[2]?.textContent).toBe('1절');
  });

  it('labels unnamed groups with position and none color', async () => {
    await setupGrouped({unnamed: true});
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');
    expect(chips).toHaveLength(3);
    expect(chips[0]?.textContent).toBe('이름표 없음 1');
    expect(chips[1]?.textContent).toBe('이름표 없음 2');
    expect(chips[2]?.textContent).toBe('이름표 없음 1');
  });

  it('selects first slide of the clicked group occurrence', async () => {
    const {onSelect, user} = await setupGrouped();
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');

    const secondChip = chips[1];
    if (secondChip === undefined) throw new Error('Missing chip');
    await user.click(secondChip);
    expect(onSelect).toHaveBeenCalledWith(2);

    const thirdChip = chips[2];
    if (thirdChip === undefined) throw new Error('Missing chip');
    await user.click(thirdChip);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('reorders groups via keyboard Alt+Arrow and moves selection to new group start', async () => {
    const {session, onSelect, user} = await setupGrouped();
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');

    const firstChip = chips[0];
    if (firstChip === undefined) throw new Error('Missing chip');
    await user.click(firstChip);

    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(
      session.history.snapshot.song.arrangements?.[0]?.groups,
    ).toBeDefined();
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('removes a group occurrence on Delete key', async () => {
    const {session, user} = await setupGrouped();
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');

    const secondChip = chips[1];
    if (secondChip === undefined) throw new Error('Missing chip');
    await user.click(secondChip);

    await user.keyboard('{Delete}');
    const currentGroups =
      session.history.snapshot.song.arrangements?.[0]?.groups;
    expect(currentGroups).toHaveLength(2);
  });

  it('opens 그룹 넣기 menu and appends chosen group', async () => {
    const {session, g3Id, user} = await setupGrouped();
    const insertButton = screen.getByRole('button', {name: '슬라이드 넣기'});
    await user.click(insertButton);

    const menu = await screen.findByRole('menu', {name: '그룹 넣기'});
    expect(menu).toBeDefined();

    const menuItems = within(menu).getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
    expect(menuItems[0]?.textContent).toContain('1절');
    expect(menuItems[0]?.textContent).toContain('1절 첫째 줄');
    expect(menuItems[1]?.textContent).toContain('후렴');
    expect(menuItems[1]?.textContent).toContain('후렴 첫째 줄');
    expect(menuItems[2]?.textContent).toContain('이름표 없음 3');
    expect(menuItems[2]?.textContent).toContain('아멘');

    const thirdItem = menuItems[2];
    if (thirdItem === undefined) throw new Error('Missing menuitem');
    await user.click(thirdItem);

    const currentGroups =
      session.history.snapshot.song.arrangements?.[0]?.groups;
    expect(currentGroups).toHaveLength(4);
    expect(currentGroups?.[3]).toBe(g3Id);
  });

  it('displays DEFAULT_ORDER_REASON tooltip when 기본 arrangement is active', async () => {
    await setupGrouped({arrangement: undefined});
    const chips = screen.getAllByRole('option');
    const first = chips[0];
    if (first === undefined) throw new Error('Missing chip');
    const tooltip = await hoverForTooltip(first);
    expect(tooltip?.textContent).toContain(DEFAULT_ORDER_REASON);
  });

  it('displays NEWER_FILE_REASON tooltip when song is readOnly', async () => {
    await setupGrouped({readOnly: true});
    const chips = screen.getAllByRole('option');
    const first = chips[0];
    if (first === undefined) throw new Error('Missing chip');
    const tooltip = await hoverForTooltip(first);
    expect(tooltip?.textContent).toContain(NEWER_FILE_REASON);
  });

  it('renders zero chips for an empty named 구성 without errors', async () => {
    await setupGrouped({arrangement: '빈 구성'});
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).queryAllByRole('option');
    expect(chips).toHaveLength(0);
    expect(screen.queryByRole('img', {name: /구성이 없어/})).toBeNull();
  });

  it('handles an arrangement with a dangling group id first by filtering it when read, allowing remove without offset', async () => {
    const {session, g2Id, g1Id, user} = await setupGrouped({
      danglingFirst: true,
    });
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');
    expect(chips).toHaveLength(3);
    expect(chips[0]?.textContent).toBe('1절');
    expect(chips[1]?.textContent).toBe('후렴');
    expect(chips[2]?.textContent).toBe('1절');

    const firstChip = chips[0];
    if (firstChip === undefined) throw new Error('Missing chip');
    await user.click(firstChip);
    await user.keyboard('{Delete}');
    expect(session.history.snapshot.song.arrangements?.[0]?.groups).toEqual([
      g2Id,
      g1Id,
    ]);
  });

  it('moves groups accurately without offset when arrangement starts with a dangling id', async () => {
    const {session, g1Id, g2Id, user} = await setupGrouped({
      danglingFirst: true,
    });
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).getAllByRole('option');

    const firstChip = chips[0];
    if (firstChip === undefined) throw new Error('Missing chip');
    await user.click(firstChip);
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(session.history.snapshot.song.arrangements?.[0]?.groups).toEqual([
      g2Id,
      g1Id,
      g1Id,
    ]);
  });
});
