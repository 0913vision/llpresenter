import {expect, it, vi} from 'vitest';
import {menuItems} from '@renderer/ui/menuModel';
import {
  serviceOrderMenuEntries,
  type ServiceOrderMenuInput,
} from '@renderer/features/service/order/serviceOrderMenu';

it('omits the unavailable editor group without an empty separator in prep', () => {
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    remove: vi.fn(),
  });
  expect(
    entries.map(entry => (entry.kind === 'separator' ? '|' : entry.id)),
  ).toEqual([
    'hide',
    '|',
    'arrangement',
    'destination',
    '|',
    'copy',
    'paste',
    'duplicate',
    'delete',
    '|',
    'show-in-library',
    'export-bundle',
    'export-images',
  ]);
});

it('explains protected edits and unavailable arrangement and library actions', () => {
  const input: ServiceOrderMenuInput = {
    row: {kind: 'header', id: 'row', title: '구역'},
    editable: false,
    openInPrep: undefined,
    rename: vi.fn(),
    remove: vi.fn(),
  };
  const header = menuItems(serviceOrderMenuEntries(input));
  for (const id of ['rename', 'delete']) {
    expect(header.find(row => row.id === id)).toMatchObject({
      disabled: true,
      title: '예배 순서 편집 불가',
    });
  }
  const song = {
    ...input,
    editable: true,
    row: {...input.row, kind: 'song' as const},
  };
  const missing = menuItems(serviceOrderMenuEntries(song));
  expect(missing.find(row => row.id === 'arrangement')?.title).toBe(
    '구성 변경 불가',
  );
  expect(missing.find(row => row.id === 'show-in-library')?.title).toBe(
    '라이브러리 연결 안 됨',
  );
  const loading = menuItems(
    serviceOrderMenuEntries({
      ...song,
      song: {
        arrangements: [],
        locked: true,
        reason: '불러오는 중',
        showInLibrary: undefined,
      },
    }),
  );
  for (const id of ['arrangement', 'show-in-library']) {
    expect(loading.find(row => row.id === id)?.title).toBe('불러오는 중');
  }
});

it('puts 순서 편집 and 곡 편집 after 구성 in the prep menu and runs them', () => {
  const editOrder = vi.fn();
  const editSong = vi.fn();
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    remove: vi.fn(),
    editSong: {editOrder, editSong},
  });
  const ids = entries.map(entry =>
    entry.kind === 'separator' ? '|' : entry.id,
  );
  expect(ids.slice(0, 8)).toEqual([
    'hide',
    '|',
    'arrangement',
    '|',
    'edit-order',
    'edit-song',
    '|',
    'destination',
  ]);
  const rows = menuItems(entries);
  rows.find(row => row.id === 'edit-order')?.onSelect?.();
  rows.find(row => row.id === 'edit-song')?.onSelect?.();
  expect(editOrder).toHaveBeenCalledOnce();
  expect(editSong).toHaveBeenCalledOnce();
});

it('disables 곡 편집 without a song and both while the song loads', () => {
  const base: ServiceOrderMenuInput = {
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    remove: vi.fn(),
    editSong: {editOrder: vi.fn(), editSong: undefined},
  };
  const missing = menuItems(serviceOrderMenuEntries(base));
  expect(missing.find(row => row.id === 'edit-song')).toMatchObject({
    disabled: true,
    title: '곡을 찾을 수 없습니다',
  });
  const loading = menuItems(
    serviceOrderMenuEntries({
      ...base,
      song: {
        arrangements: [],
        locked: true,
        reason: '불러오는 중',
        showInLibrary: undefined,
      },
    }),
  );
  for (const id of ['edit-order', 'edit-song']) {
    expect(loading.find(row => row.id === id)?.title).toBe('불러오는 중');
  }
});

it('does not add the editor rows in 진행', () => {
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    remove: vi.fn(),
  });
  expect(menuItems(entries).some(row => row.id === 'edit-order')).toBe(false);
});
