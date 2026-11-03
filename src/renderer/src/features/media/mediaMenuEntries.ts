import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
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
  readonly duplicate: (id: MediaId) => void;
  readonly remove: (item: MediaItem) => void;
  readonly reveal: (id: MediaId) => void;
  readonly rename: (item: MediaItem) => void;
}

function propertiesRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'properties',
    label: '속성…',
    onSelect: () => actions.properties(item.id),
  };
}

function duplicateRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'duplicate',
    label: '복제',
    icon: actions.audioPlaylist ? undefined : 'duplicate',
    ...menuAvailability(actions.editable ? undefined : NEWER_FILE_REASON),
    onSelect: () => actions.duplicate(item.id),
  };
}

function deleteRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'delete',
    label: '삭제',
    icon: actions.audioPlaylist ? undefined : 'trash',
    danger: true,
    ...menuAvailability(actions.editable ? undefined : NEWER_FILE_REASON),
    onSelect: () => actions.remove(item),
  };
}

function revealRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'reveal',
    label: '탐색기에서 보기',
    onSelect: () => actions.reveal(item.id),
  };
}

function renameRow(item: MediaItem, actions: MediaTileActions): MenuEntry {
  return {
    kind: 'item',
    id: 'rename',
    label: '이름 바꾸기',
    ...menuAvailability(actions.editable ? undefined : NEWER_FILE_REASON),
    onSelect: () => actions.rename(item),
  };
}

function audioRows(
  item: MediaItem,
  actions: MediaTileActions,
): readonly MenuEntry[] {
  return [
    revealRow(item, actions),
    laterRow('playback', '재생', {submenu: true}),
    laterRow('sound-effect', '효과음으로 지정'),
    menuSeparator('properties-separator'),
    propertiesRow(item, actions),
    duplicateRow(item, actions),
    renameRow(item, actions),
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
    laterRow('behavior', '동작', {submenu: true}),
    laterRow('scaling', '맞춤', {submenu: true}),
    laterRow('alpha', '알파', {submenu: true}),
    menuSeparator('playback-separator'),
    laterRow('playback', '재생', {submenu: true}),
    laterRow('loop', '반복', {submenu: true}),
    laterRow('end', '끝나면', {submenu: true}),
    menuSeparator('next-separator'),
    laterRow('next', '다음 항목', {submenu: true}),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    duplicateRow(item, actions),
    renameRow(item, actions),
    ...(actions.inPlaylist
      ? [
          {
            kind: 'item' as const,
            id: 'leave',
            label: '재생목록에서 빼기',
            ...menuAvailability(
              actions.editable ? undefined : NEWER_FILE_REASON,
            ),
            onSelect: () => actions.leave(item.id),
          },
        ]
      : []),
    deleteRow(item, actions),
    menuSeparator('export-separator'),
    revealRow(item, actions),
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

export function playlistMenuEntries(
  editable: boolean,
  duplicate?: () => void,
): readonly MenuEntry[] {
  const title = editable ? undefined : NEWER_FILE_REASON;
  return [
    laterRow('communications', '통신에 사용'),
    menuSeparator('edit-separator'),
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(title),
    },
    {
      kind: 'item',
      id: 'duplicate',
      label: '복제',
      ...menuAvailability(title),
      onSelect: duplicate,
    },
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(title),
    },
  ];
}
