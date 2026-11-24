import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
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
  return locked ? (busy ? '저장 중' : '지금은 바꿀 수 없습니다.') : undefined;
}

function command(
  item: Pick<MenuItem, 'id' | 'label' | 'onSelect' | 'contextGroup'>,
  reason: string | undefined,
): MenuItem {
  return {
    kind: 'item',
    ...item,
    ...menuAvailability(reason),
  };
}

/** What the rows of a tool's list can do, and why they can't now. */
interface ToolRowActions {
  readonly rename: () => void;
  readonly duplicate: () => void;
  /** Why 복제 can't run, such as a full list; the lock reason comes first. */
  readonly duplicateReason: string | undefined;
  readonly remove: () => void;
  readonly reason: string | undefined;
}

function editRow(
  onSelect: () => void,
  reason: string | undefined,
  contextGroup: MenuItem['contextGroup'] = 'default',
): MenuItem {
  return command({id: 'edit', contextGroup, label: '수정…', onSelect}, reason);
}

function duplicateRow({
  duplicate,
  duplicateReason,
  reason,
}: Pick<ToolRowActions, 'duplicate' | 'duplicateReason' | 'reason'>): MenuItem {
  return command(
    {
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: '복제',
      onSelect: duplicate,
    },
    reason ?? duplicateReason,
  );
}

function renameRow({
  rename,
  reason,
}: Pick<ToolRowActions, 'rename' | 'reason'>): MenuItem {
  return command(
    {id: 'rename', label: '이름 바꾸기', onSelect: rename},
    reason,
  );
}

function deleteRow({
  remove,
  reason,
}: Pick<ToolRowActions, 'remove' | 'reason'>): MenuItem {
  return {
    ...command(
      {id: 'delete', contextGroup: 'delete', label: '삭제', onSelect: remove},
      reason,
    ),
    danger: true,
  };
}

/** The shared timer list-row shape, including disabled editing commands. */
export function namedToolMenuEntries(
  actions: Omit<ToolRowActions, 'remove'> & {
    /** Opens the row's own editor; a row without one leaves it out. */
    readonly edit?: (() => void) | undefined;
    readonly remove: (() => void) | undefined;
  },
): readonly MenuEntry[] {
  const {edit, remove, reason} = actions;
  return [
    ...(edit ? [editRow(edit, reason)] : []),
    duplicateRow(actions),
    renameRow(actions),
    ...(remove
      ? [menuSeparator('delete-separator'), deleteRow({remove, reason})]
      : []),
  ];
}

/** Message templates retain their edit, clipboard and delete groups. */
export function messageMenuEntries(
  actions: ToolRowActions & {readonly edit: () => void},
): readonly MenuEntry[] {
  return [
    editRow(actions.edit, actions.reason),
    menuSeparator('copy-separator'),
    duplicateRow(actions),
    renameRow(actions),
    menuSeparator('delete-separator'),
    deleteRow(actions),
  ];
}

/** Props keep their future rows while the existing commands expose lock reasons. */
export function propMenuEntries(
  actions: ToolRowActions & {readonly edit: () => void},
): readonly MenuEntry[] {
  return [
    laterRow('add-to', '모음에 추가', {submenu: true}),
    laterRow('move-to', '모음으로 옮기기', {submenu: true}),
    menuSeparator('edit-separator'),
    editRow(actions.edit, actions.reason, 'settings'),
    laterRow('transitions', '전환 효과…'),
    laterRow('auto-clear', '자동 지우기', {submenu: true}),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    {...duplicateRow(actions), icon: 'duplicate'},
    renameRow(actions),
    menuSeparator('delete-separator'),
    {...deleteRow(actions), icon: 'trash'},
  ];
}

/** The quick item's three commands need neither icons nor a separator. */
export function quickItemMenuEntries(
  actions: ToolRowActions & {
    /** A 타이머 row opens its 타이머 here, with the reason it can't. */
    readonly edit?: {
      readonly onSelect: () => void;
      readonly reason: string | undefined;
    };
  },
): readonly MenuEntry[] {
  const {edit, reason} = actions;
  return [
    ...(edit
      ? [editRow(edit.onSelect, reason ?? edit.reason, 'settings')]
      : []),
    duplicateRow(actions),
    renameRow(actions),
    deleteRow(actions),
  ];
}
