import {expect, it, vi} from 'vitest';
import {libraryFixture} from './fixture';
import {libraryMenuEntries} from './libraryMenuEntries';
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
    remove: vi.fn(),
  };
  const busy = menuItems(libraryMenuEntries(input));
  for (const id of ['add-to', 'lyrics', 'delete']) {
    expect(busy.find(row => row.id === id)).toMatchObject({
      disabled: true,
      title: '곡 작업 중',
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
    '읽기 전용 곡입니다',
  );
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
    remove: vi.fn(),
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
