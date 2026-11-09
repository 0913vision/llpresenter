import {expect, it, vi} from 'vitest';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {menuItems} from '@renderer/ui/menuModel';
import {
  serviceOrderMenuEntries,
  type ServiceOrderMenuInput,
} from '@renderer/features/service/order/serviceOrderMenu';

it('explains when selected rows cannot move farther', () => {
  const entries = menuItems(
    serviceOrderMenuEntries({
      row: {kind: 'song', id: 'row', title: '곡'},
      editable: true,
      openInPrep: undefined,
      rename: vi.fn(),
      duplicate: vi.fn(),
      remove: vi.fn(),
      moveUp: vi.fn(),
      moveDown: vi.fn(),
      moveUpReason: '맨 위입니다',
      moveDownReason: '맨 아래입니다',
    }),
  );
  expect(entries.find(row => row.id === 'move-up')).toMatchObject({
    disabled: true,
    title: '맨 위입니다',
  });
  expect(entries.find(row => row.id === 'move-down')).toMatchObject({
    disabled: true,
    title: '맨 아래입니다',
  });
});

it('omits the unavailable editor group without an empty separator in prep', () => {
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
  });
  expect(
    entries.map(entry => (entry.kind === 'separator' ? '|' : entry.id)),
  ).toEqual([
    'hide',
    '|',
    'save-to-library',
    'reload-from-library',
    'destination',
    '|',
    'copy',
    'paste',
    'duplicate',
    'move-up',
    'move-down',
    'delete',
    '|',
    'show-in-library',
    'export-bundle',
    'export-images',
  ]);
});

it('explains protected edits and unavailable library actions', () => {
  const input: ServiceOrderMenuInput = {
    row: {kind: 'header', id: 'row', title: '구역'},
    editable: false,
    openInPrep: undefined,
    rename: vi.fn(),
    duplicate: vi.fn(),
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
  expect(missing.find(row => row.id === 'show-in-library')?.title).toBe(
    '이 창에서는 쓸 수 없음',
  );
  const loading = menuItems(
    serviceOrderMenuEntries({
      ...song,
      song: {
        save: vi.fn(),
        reload: vi.fn(),
        locked: true,
        reason: '불러오는 중',
        showInLibrary: undefined,
      },
    }),
  );
  for (const id of [
    'save-to-library',
    'reload-from-library',
    'show-in-library',
  ]) {
    expect(loading.find(row => row.id === id)?.title).toBe('불러오는 중');
  }
});

it('puts the item editor after library transfer actions and runs it', () => {
  const editSong = vi.fn();
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    editSong: {editSong},
  });
  const ids = entries.map(entry =>
    entry.kind === 'separator' ? '|' : entry.id,
  );
  expect(ids.slice(0, 8)).toEqual([
    'hide',
    '|',
    'save-to-library',
    'reload-from-library',
    '|',
    'edit-song',
    '|',
    'destination',
  ]);
  const rows = menuItems(entries);
  rows.find(row => row.id === 'edit-song')?.onSelect?.();
  expect(editSong).toHaveBeenCalledOnce();
});

it('disables 곡 편집 without a song and both while the song loads', () => {
  const base: ServiceOrderMenuInput = {
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    editSong: {editSong: undefined},
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
        save: vi.fn(),
        reload: vi.fn(),
        locked: true,
        reason: '불러오는 중',
        showInLibrary: undefined,
      },
    }),
  );
  for (const id of ['edit-song']) {
    expect(loading.find(row => row.id === id)?.title).toBe('불러오는 중');
  }
});

it('does not add the editor rows in 진행', () => {
  const entries = serviceOrderMenuEntries({
    row: {kind: 'song', id: 'row', title: '곡'},
    editable: true,
    openInPrep: undefined,
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
  });
  expect(menuItems(entries).some(row => row.id === 'edit-order')).toBe(false);
});

it('disables 복제 with the limit sentence when the 예배 순서 is full', () => {
  const entries = menuItems(
    serviceOrderMenuEntries({
      row: {kind: 'song', id: 'row', title: '곡'},
      editable: true,
      full: true,
      openInPrep: undefined,
      rename: vi.fn(),
      duplicate: vi.fn(),
      remove: vi.fn(),
    }),
  );
  expect(entries.find(row => row.id === 'duplicate')).toMatchObject({
    disabled: true,
    title: ORDER_FULL_REASON,
  });
});
