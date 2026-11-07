import {expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {libraryMenuEntries} from '@renderer/features/songs/library/libraryMenuEntries';
import {menuItems} from '@renderer/ui/menuModel';

it('retains specific reasons ahead of busy state and explains busy commands', () => {
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing fixture');
  const input = {
    song,
    appendDisabledReason: undefined,
    busy: true,
    append: vi.fn(),
    open: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    reveal: vi.fn(),
  };
  const busy = menuItems(libraryMenuEntries(input));
  for (const id of ['add-to', 'lyrics', 'duplicate', 'rename', 'delete']) {
    expect(busy.find(row => row.id === id)).toMatchObject({
      disabled: true,
      title: '작업 중',
    });
  }
  const protectedRows = menuItems(
    libraryMenuEntries({
      ...input,
      appendDisabledReason: '열린 예배 없음',
      song: {...song, access: 'readOnly'},
    }),
  );
  expect(protectedRows.find(row => row.id === 'add-to')?.title).toBe(
    '열린 예배 없음',
  );
  expect(protectedRows.find(row => row.id === 'delete')?.title).toBe(
    '새 버전의 파일이라 바꿀 수 없습니다',
  );
  expect(protectedRows.find(row => row.id === 'duplicate')).toMatchObject({
    disabled: true,
    title: '새 버전의 파일이라 바꿀 수 없습니다',
  });
});

it('turns 복제 on for an editable song and runs the copy', () => {
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing fixture');
  const duplicate = vi.fn();
  const row = menuItems(
    libraryMenuEntries({
      song,
      appendDisabledReason: undefined,
      busy: false,
      append: vi.fn(),
      open: vi.fn(),
      duplicate,
      remove: vi.fn(),
      rename: vi.fn(),
      reveal: vi.fn(),
    }),
  ).find(entry => entry.id === 'duplicate');
  expect(row).toMatchObject({disabled: false});
  row?.onSelect?.();
  expect(duplicate).toHaveBeenCalledOnce();
});

it('adds to the open service with one command and no submenu', () => {
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing fixture');
  const append = vi.fn();
  const rows = libraryMenuEntries({
    song,
    appendDisabledReason: undefined,
    busy: false,
    append,
    open: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    reveal: vi.fn(),
  });
  const add = rows[0];
  for (const row of rows) {
    if (row.kind === 'item' && row.disabled && row.id !== 'add-to') {
      expect(row.title).toBe('아직 없는 기능');
    }
  }
  if (add?.kind !== 'item') throw new Error('Missing command');
  expect(add.submenu).toBeUndefined();
  expect(add.disabled).toBe(false);
  add.onSelect?.();
  expect(append).toHaveBeenCalledExactlyOnceWith();
});

it('runs 이름 바꾸기 and 탐색기에서 보기 as commands, and protects a newer file', () => {
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing fixture');
  const rename = vi.fn();
  const reveal = vi.fn();
  const input = {
    song,
    appendDisabledReason: undefined,
    busy: false,
    append: vi.fn(),
    open: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    rename,
    reveal,
  };
  const rows = menuItems(libraryMenuEntries(input));
  const renameRow = rows.find(row => row.id === 'rename');
  const revealRow = rows.find(row => row.id === 'reveal');
  expect(renameRow).toMatchObject({label: '이름 바꾸기', disabled: false});
  expect(revealRow).toMatchObject({label: '탐색기에서 보기'});
  expect(revealRow?.disabled).not.toBe(true);
  renameRow?.onSelect?.();
  revealRow?.onSelect?.();
  expect(rename).toHaveBeenCalledOnce();
  expect(reveal).toHaveBeenCalledOnce();
  const newer = menuItems(
    libraryMenuEntries({...input, song: {...song, access: 'readOnly'}}),
  );
  expect(newer.find(row => row.id === 'rename')).toMatchObject({
    disabled: true,
    title: '새 버전의 파일이라 바꿀 수 없습니다',
  });
});
