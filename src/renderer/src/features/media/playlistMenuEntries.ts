import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menus/menuRows';

/**
 * The context menu of a playlist; its editing rows are disabled with a reason
 * when `editable` is false.
 */
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
      contextGroup: 'clipboard',
      label: '복제',
      ...menuAvailability(title),
      onSelect: duplicate,
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(title),
    },
  ];
}
