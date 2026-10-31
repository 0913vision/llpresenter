import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';
import type {MediaEntry} from './mediaEntries';

export interface MediaTileActions {
  readonly missing: boolean;
  readonly editable: boolean;
  readonly inPlaylist: boolean;
  readonly audioPlaylist: boolean;
  readonly properties: (id: MediaId) => void;
  readonly cancel: (id: MediaId) => void;
  readonly relink: (id: MediaId) => void;
  readonly leave: (id: MediaId) => void;
  readonly remove: (item: MediaItem) => void;
}

function propertiesRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'properties',
    label: '속성…',
    onSelect: () => actions.properties(item.id),
  };
}

function deleteRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'delete',
    label: '삭제',
    icon: actions.audioPlaylist ? undefined : 'trash',
    danger: true,
    disabled: !actions.editable,
    title: actions.editable ? undefined : '읽기 전용 미디어 목록',
    onSelect: () => actions.remove(item),
  };
}

function audioRows(
  item: MediaItem,
  actions: MediaTileActions,
): readonly MenuEntry[] {
  return [
    laterRow('reveal', '탐색기에서 보기'),
    laterRow('playback', '재생 방식', {submenu: true}),
    laterRow('sound-effect', '효과음으로 지정'),
    menuSeparator('properties-separator'),
    propertiesRow(item, actions),
    laterRow('rename', '이름 바꾸기'),
    menuSeparator('delete-separator'),
    deleteRow(item, actions),
  ];
}

function mediaRows(
  item: MediaItem,
  actions: MediaTileActions,
): readonly MenuEntry[] {
  return [
    propertiesRow(item, actions),
    laterRow('transition', '전환 효과…'),
    menuSeparator('behavior-separator'),
    laterRow('behavior', '동작 방식', {submenu: true}),
    laterRow('scaling', '크기 맞춤', {submenu: true}),
    laterRow('alpha', '알파 종류', {submenu: true}),
    menuSeparator('playback-separator'),
    laterRow('playback', '재생 방식', {submenu: true}),
    laterRow('loop', '반복 방식', {submenu: true}),
    laterRow('end', '끝날 때', {submenu: true}),
    menuSeparator('next-separator'),
    laterRow('next', '다음 큐', {submenu: true}),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    laterRow('duplicate', '복제', {icon: 'duplicate'}),
    laterRow('rename', '이름 바꾸기'),
    ...(actions.inPlaylist
      ? [
          {
            kind: 'item' as const,
            id: 'leave',
            label: '재생목록에서 빼기',
            disabled: !actions.editable,
            title: actions.editable ? undefined : '읽기 전용 미디어 목록',
            onSelect: () => actions.leave(item.id),
          },
        ]
      : []),
    deleteRow(item, actions),
    menuSeparator('export-separator'),
    laterRow('reveal', '탐색기에서 보기'),
    laterRow('cleanup', '정리 기준', {submenu: true}),
  ];
}

export function mediaTileMenuEntries(
  entry: MediaEntry,
  actions: MediaTileActions,
): readonly MenuEntry[] {
  const copying =
    entry.kind === 'copy'
      ? entry.job.mediaId
      : entry.copying === undefined
        ? null
        : entry.item.id;
  if (copying !== null) {
    return [
      {
        kind: 'item',
        id: 'cancel',
        label: '복사 멈추기',
        onSelect: () => actions.cancel(copying),
      },
    ];
  }
  if (entry.kind !== 'media') return [];
  const {item} = entry;
  return [
    ...(actions.missing
      ? [
          {
            kind: 'item' as const,
            id: 'relink',
            label: '다시 연결…',
            onSelect: () => actions.relink(item.id),
          },
          menuSeparator('relink-separator'),
        ]
      : []),
    ...(actions.audioPlaylist
      ? audioRows(item, actions)
      : mediaRows(item, actions)),
  ];
}

export function playlistMenuEntries(editable: boolean): readonly MenuEntry[] {
  const title = editable ? undefined : '읽기 전용 미디어 목록';
  return [
    laterRow('communications', '통신에 사용'),
    menuSeparator('edit-separator'),
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      disabled: !editable,
      title,
    },
    laterRow('duplicate', '복제'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      danger: true,
      disabled: !editable,
      title,
    },
  ];
}
