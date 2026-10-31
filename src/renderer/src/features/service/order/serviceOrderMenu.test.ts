import {expect, it, vi} from 'vitest';
import {menuItems} from '@renderer/ui/menuModel';
import {
  serviceOrderMenuEntries,
  type ServiceOrderMenuInput,
} from './serviceOrderMenu';

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
