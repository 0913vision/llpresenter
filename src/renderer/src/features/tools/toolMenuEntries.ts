import {menuAvailability} from '@renderer/ui/menuModel';
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
    ...menuAvailability(reason),
  };
}

/** The shared timer/notice list-row shape, including disabled editing commands. */
export function namedToolMenuEntries({
  rename,
  duplicate,
  duplicateReason,
  remove,
  reason,
}: {
  readonly rename: () => void;
  readonly duplicate: () => void;
  /** Why 복제 can't run, such as a full list; the lock reason comes first. */
  readonly duplicateReason: string | undefined;
  readonly remove: (() => void) | undefined;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    command(
      {id: 'duplicate', label: '복제', onSelect: duplicate},
      reason ?? duplicateReason,
    ),
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
  duplicate,
  duplicateReason,
  remove,
  reason,
}: {
  readonly edit: () => void;
  readonly duplicate: () => void;
  /** Why 복제 can't run, such as a full list; the lock reason comes first. */
  readonly duplicateReason: string | undefined;
  readonly remove: () => void;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    command({id: 'edit', label: '수정…', onSelect: edit}, reason),
    menuSeparator('copy-separator'),
    command(
      {id: 'duplicate', label: '복제', onSelect: duplicate},
      reason ?? duplicateReason,
    ),
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
  duplicate,
  duplicateReason,
  remove,
  reason,
}: {
  readonly edit: () => void;
  readonly duplicate: () => void;
  /** Why 복제 can't run, such as a full list; the lock reason comes first. */
  readonly duplicateReason: string | undefined;
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
    {
      ...command(
        {id: 'duplicate', label: '복제', onSelect: duplicate},
        reason ?? duplicateReason,
      ),
      icon: 'duplicate',
    },
    laterRow('rename', '이름 바꾸기'),
    menuSeparator('delete-separator'),
    {
      ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
      icon: 'trash',
      danger: true,
    },
  ];
}

/** The quick item's three commands need neither icons nor a separator. */
export function quickItemMenuEntries({
  rename,
  duplicate,
  duplicateReason,
  remove,
  reason,
}: {
  readonly rename: () => void;
  readonly duplicate: () => void;
  /** Why 복제 can't run, such as a full list; the lock reason comes first. */
  readonly duplicateReason: string | undefined;
  readonly remove: () => void;
  readonly reason: string | undefined;
}): readonly MenuEntry[] {
  return [
    command(
      {id: 'duplicate', label: '복제', onSelect: duplicate},
      reason ?? duplicateReason,
    ),
    command({id: 'rename', label: '이름 바꾸기', onSelect: rename}, reason),
    {
      ...command({id: 'delete', label: '삭제', onSelect: remove}, reason),
      danger: true,
    },
  ];
}
