import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';

const OPEN_SERVICE = '열린 예배는 삭제할 수 없습니다.';

/**
 * The right-click menu of a 템플릿 or 예배 순서 row in the service dialogs:
 * 이름 바꾸기 and 삭제. A file of a newer version takes neither, and the open
 * 예배 순서 can't be deleted.
 */
export function sourceMenuEntries({
  readOnly,
  open,
  onRename,
  onDelete,
}: {
  readonly readOnly: boolean;
  /** The row is the 예배 순서 that is open. */
  readonly open: boolean;
  readonly onRename: () => void;
  readonly onDelete: () => void;
}): readonly MenuEntry[] {
  const readOnlyReason = readOnly ? NEWER_FILE_REASON : undefined;
  return [
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(readOnlyReason),
      onSelect: onRename,
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(readOnlyReason ?? (open ? OPEN_SERVICE : undefined)),
      onSelect: onDelete,
    },
  ];
}
