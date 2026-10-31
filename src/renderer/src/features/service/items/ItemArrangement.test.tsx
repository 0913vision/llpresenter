import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  createServiceItemId,
  createSongGroupId,
  createSongId,
  type SongId,
} from '@core/schema/ids';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {SongSession} from '@renderer/features/songs/editor/songSession';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {fixtureServiceId, itemFixture} from './itemFixture';
import {ServiceItemStore} from './serviceItemStore';
import {ItemArrangement} from './ItemArrangement';

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
    large?: boolean;
  } = {},
) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const sample = createTestGroupedSong(
    options.unnamed,
    options.readOnly,
    options.danglingFirst,
  );
  const {g1Id, g2Id, g3Id} = sample;
  const firstGroup = sample.document.song.groups[0];
  if (firstGroup === undefined) throw new Error('Missing group');
  const document = options.large
    ? {
        ...sample.document,
        song: {
          ...sample.document.song,
          groups: [
            {
              ...firstGroup,
              slides: Array.from({length: 10_000}, () => ({
                lines: ['Invented'],
              })),
            },
          ],
          arrangements: [
            {name: 'Large', groups: Array.from({length: 100_000}, () => g1Id)},
          ],
        },
      }
    : sample.document;

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
  fixture.documents.set(document.song.id, document);

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

  const onSelect = vi.fn();
  const onEditSong = vi.fn();
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
      onEditSong={onEditSong}
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
    onEditSong,
    view,
    labels,
    user: userEvent.setup(),
  };
}

describe('ItemArrangement with grouped songs', () => {
  it('routes shared menu management to the source editor without mutating the item', async () => {
    const {user, onEditSong, edits} = await setupGrouped();
    for (const [label, action] of [
      ['새 구성…', 'create-arrangement'],
      ['이름 바꾸기…', 'rename-arrangement'],
      ['지우기', 'delete-arrangement'],
      ['구성 편집…', 'edit-arrangement'],
    ] as const) {
      await user.click(screen.getByRole('button', {name: '구성'}));
      await user.click(screen.getByRole('menuitem', {name: label}));
      expect(onEditSong).toHaveBeenLastCalledWith(action);
    }
    expect(edits).toEqual([]);
  });

  it('protects the default arrangement in the shared management menu', async () => {
    const {user} = await setupGrouped({arrangement: undefined});
    await user.click(screen.getByRole('button', {name: '구성'}));
    const rename = screen.getByRole('menuitem', {name: '이름 바꾸기…'});
    expect(rename.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen
        .getByRole('menuitem', {name: '지우기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect((await hoverForTooltip(rename))?.textContent).toBe(
      '기본 구성은 바꿀 수 없습니다',
    );
  });
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
  it('does not render or edit a huge arrangement as 100,000 chips', async () => {
    const {session} = await setupGrouped({large: true, arrangement: 'Large'});
    expect(
      within(screen.getByRole('listbox', {name: '구성 순서'})).queryAllByRole(
        'option',
      ),
    ).toHaveLength(0);
    expect(screen.queryByRole('button', {name: '그룹 넣기'})).toBeNull();
    expect(
      session.history.snapshot.song.arrangements?.[0]?.groups,
    ).toHaveLength(100_000);
  });

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

  it('renders zero chips for an empty named 구성 without errors', async () => {
    await setupGrouped({arrangement: '빈 구성'});
    const listbox = screen.getByRole('listbox', {name: '구성 순서'});
    const chips = within(listbox).queryAllByRole('option');
    expect(chips).toHaveLength(0);
    expect(screen.queryByRole('img', {name: /구성이 없어/})).toBeNull();
  });
});
