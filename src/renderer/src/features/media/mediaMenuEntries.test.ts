import {expect, it, vi} from 'vitest';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {mediaItem} from './mediaTesting';
import {
  mediaTileMenuEntries,
  playlistMenuEntries,
  type MediaTileActions,
} from './mediaMenuEntries';

function actions(overrides: Partial<MediaTileActions> = {}): MediaTileActions {
  return {
    missing: false,
    editable: true,
    inPlaylist: false,
    audioPlaylist: false,
    properties: vi.fn(),
    cancel: vi.fn(),
    relink: vi.fn(),
    leave: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

function rows(entries: readonly MenuEntry[]): readonly string[] {
  return entries.map(entry => (entry.kind === 'separator' ? '|' : entry.label));
}

const item = mediaItem(1, {name: 'Invented video'});
const entry = {kind: 'media' as const, id: item.id, item, copying: undefined};

it('lists the media tile rows and icons in ProPresenter order', () => {
  const entries = mediaTileMenuEntries(entry, actions());
  expect(rows(entries)).toEqual([
    '속성…',
    '전환 효과…',
    '|',
    '동작 방식',
    '크기 맞춤',
    '알파 종류',
    '|',
    '재생 방식',
    '반복 방식',
    '끝날 때',
    '|',
    '다음 큐',
    '|',
    '잘라내기',
    '복사',
    '붙여넣기',
    '복제',
    '이름 바꾸기',
    '삭제',
    '|',
    '탐색기에서 보기',
    '정리 기준',
  ]);
  expect(
    entries
      .filter(row => row.kind === 'item' && row.icon !== undefined)
      .map(row => row.id),
  ).toEqual(['cut', 'copy', 'paste', 'duplicate', 'delete']);
  for (const row of entries) {
    if (row.kind === 'item' && !['delete', 'properties'].includes(row.id)) {
      expect(row).toMatchObject({disabled: true, title: '아직 없는 기능'});
    }
  }
});

it('lists the audio playlist item rows without icons', () => {
  const entries = mediaTileMenuEntries(
    entry,
    actions({audioPlaylist: true, inPlaylist: true}),
  );
  expect(rows(entries)).toEqual([
    '탐색기에서 보기',
    '재생 방식',
    '효과음으로 지정',
    '|',
    '속성…',
    '이름 바꾸기',
    '|',
    '삭제',
  ]);
  expect(
    entries.some(row => row.kind === 'item' && row.icon !== undefined),
  ).toBe(false);
});

it('keeps relink first, removal before delete, and only cancellation while copying', () => {
  const handlers = actions({missing: true, inPlaylist: true});
  const entries = mediaTileMenuEntries(entry, handlers);
  expect(rows(entries).slice(0, 3)).toEqual(['다시 연결…', '|', '속성…']);
  expect(rows(entries).slice(-5)).toEqual([
    '재생목록에서 빼기',
    '삭제',
    '|',
    '탐색기에서 보기',
    '정리 기준',
  ]);
  for (const id of ['relink', 'leave', 'delete']) {
    const row = entries.find(value => value.id === id);
    if (row?.kind !== 'item') throw new Error('Missing action');
    row.onSelect?.();
  }
  expect(handlers.relink).toHaveBeenCalledWith(item.id);
  expect(handlers.leave).toHaveBeenCalledWith(item.id);
  expect(handlers.remove).toHaveBeenCalledWith(item);
  const copying = mediaTileMenuEntries({...entry, copying: 20}, handlers);
  expect(rows(copying)).toEqual(['복사 멈추기']);
  const cancel = copying[0];
  if (cancel?.kind !== 'item') throw new Error('Missing cancellation');
  cancel.onSelect?.();
  expect(handlers.cancel).toHaveBeenCalledWith(item.id);
});

it('lists playlist commands in ProPresenter order and protects read-only lists', () => {
  const entries = playlistMenuEntries(true);
  expect(rows(entries)).toEqual([
    '통신에 사용',
    '|',
    '이름 바꾸기',
    '복제',
    '삭제',
  ]);
  expect(
    playlistMenuEntries(false).every(
      row => row.kind !== 'item' || row.disabled,
    ),
  ).toBe(true);
  expect(
    mediaTileMenuEntries(entry, actions({editable: false})).every(
      row => row.kind !== 'item' || row.id === 'properties' || row.disabled,
    ),
  ).toBe(true);
});
