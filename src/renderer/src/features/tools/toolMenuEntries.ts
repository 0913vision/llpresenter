import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';

/** A local save has a more specific reason than a locked list. */
export function toolMenuReason(
  locked: boolean,
  busy = false,
): string | undefined {
  return locked ? (busy ? '저장 중입니다' : '목록이 잠겨 있습니다') : undefined;
}

function command(
  item: Pick<MenuItem, 'id' | 'label' | 'onSelect'>,
  reason: string | undefined,
): MenuItem {
  return {
    kind: 'item',
    ...item,
    disabled: reason !== undefined,
    title: reason,
  };
}

/** The shared timer/notice list-row shape, including disabled editing commands. */
export function namedToolMenuEntries({
  rename,
  remove,
  reason,
}: {
  readonly rename: () => void;
  readonly remove: (() => void) | undefined;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    laterRow('duplicate', '복제'),
    command({id: 'rename', label: '이름 바꾸기', onSelect: rename}, reason),
    ...(remove
      ? [
          menuSeparator('delete-separator'),
          {
            ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
            danger: true,
          },
        ]
      : []),
  ];
}

/** Message templates retain their edit, clipboard and delete groups. */
export function messageMenuEntries({
  edit,
  remove,
  reason,
}: {
  readonly edit: () => void;
  readonly remove: () => void;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    command({id: 'edit', label: '수정…', onSelect: edit}, reason),
    menuSeparator('copy-separator'),
    laterRow('duplicate', '복제'),
    laterRow('rename', '이름 바꾸기'),
    menuSeparator('delete-separator'),
    {
      ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
      danger: true,
    },
  ];
}

/** Props keep their future rows while the existing commands expose lock reasons. */
export function propMenuEntries({
  edit,
  remove,
  reason,
}: {
  readonly edit: () => void;
  readonly remove: () => void;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    laterRow('add-to', '모음에 추가', {submenu: true}),
    laterRow('move-to', '모음으로 옮기기', {submenu: true}),
    menuSeparator('edit-separator'),
    command({id: 'edit', label: '수정…', onSelect: edit}, reason),
    laterRow('transitions', '전환 효과…'),
    laterRow('auto-clear', '자동 지우기', {submenu: true}),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    laterRow('duplicate', '복제', {icon: 'duplicate'}),
    laterRow('rename', '이름 바꾸기'),
    menuSeparator('delete-separator'),
    {
      ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
      icon: 'trash',
      danger: true,
    },
  ];
}

/** The quick item's two commands need neither icons nor a separator. */
export function quickItemMenuEntries({
  rename,
  remove,
  reason,
}: {
  readonly rename: () => void;
  readonly remove: () => void;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    command({id: 'rename', label: '이름 바꾸기', onSelect: rename}, reason),
    {
      ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
      danger: true,
    },
  ];
}
