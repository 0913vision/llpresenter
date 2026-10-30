import {expect, it, vi} from 'vitest';
import {createServiceId} from '@core/schema/ids';
import {libraryFixture} from './fixture';
import {libraryMenuEntries} from './libraryMenuEntries';
import {serviceEntries} from '../../features/service/list/testing';

it('groups services newest first and prevents adding to a read-only service', () => {
  const song = libraryFixture().list()[0];
  const older = serviceEntries[0];
  if (!song || !older) throw new Error('Missing fixture');
  const append = vi.fn();
  const newer = {
    ...older,
    id: createServiceId('40000000-0000-4000-8000-000000000003'),
    date: '2026-10-30T09:30',
    access: 'readOnly' as const,
  };
  const rows = libraryMenuEntries({
    song,
    services: [older, newer],
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
  if (add?.kind !== 'item') throw new Error('Missing submenu');
  expect(add.submenu?.map(row => row.id)).toEqual([
    'services',
    newer.id,
    older.id,
  ]);
  const blocked = add.submenu?.[1];
  expect(blocked).toMatchObject({
    disabled: true,
    title: '읽기 전용 예배 순서입니다',
  });
  const available = add.submenu?.[2];
  if (available?.kind !== 'item') throw new Error('Missing service');
  available.onSelect?.();
  expect(append).toHaveBeenCalledWith(older.id);
});
