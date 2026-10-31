import {expect, it, vi} from 'vitest';
import {libraryFixture} from './fixture';
import {libraryMenuEntries} from './libraryMenuEntries';

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
