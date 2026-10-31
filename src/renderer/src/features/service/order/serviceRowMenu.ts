import type {ServiceEntry} from '@core/schema/contentDocuments';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

export function serviceRowMenuEntries({
  entry,
  currentId,
  busy,
  rename,
  save,
  remove,
}: {
  readonly entry: ServiceEntry;
  readonly currentId: string | null;
  readonly busy: boolean;
  readonly rename: () => void;
  readonly save: () => void;
  readonly remove: () => void;
}): readonly MenuEntry[] {
  const open = entry.id === currentId;
  return [
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(
        entry.access === 'readOnly'
          ? '읽기 전용 예배 순서'
          : busy
            ? '예배 순서 저장 중'
            : undefined,
      ),
      onSelect: rename,
    },
    {
      kind: 'item',
      id: 'save-template',
      label: '템플릿으로 저장…',
      ...menuAvailability(busy ? '예배 순서 저장 중' : undefined),
      onSelect: save,
    },
    menuSeparator('export'),
    laterRow('export', '내보내기'),
    laterRow('print', '인쇄'),
    menuSeparator('delete'),
    laterRow('duplicate', '복제'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      ...menuAvailability(
        open
          ? '열린 예배 순서는 삭제할 수 없습니다'
          : busy
            ? '예배 순서 저장 중'
            : undefined,
      ),
      onSelect: remove,
    },
  ];
}
