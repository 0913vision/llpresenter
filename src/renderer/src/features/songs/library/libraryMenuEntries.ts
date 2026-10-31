import type {LibrarySong} from '@core/schema/contentDocuments';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

export function libraryMenuEntries({
  song,
  appendDisabledReason,
  busy,
  open,
  append,
  remove,
}: {
  readonly song: LibrarySong;
  readonly appendDisabledReason: string | undefined;
  readonly busy: boolean;
  readonly open: () => void;
  readonly append: () => void;
  readonly remove: () => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'add-to',
      label: '예배 순서에 추가',
      ...menuAvailability(
        appendDisabledReason ?? (busy ? '곡 작업 중' : undefined),
      ),
      onSelect: append,
    },
    menuSeparator('arrangement-separator'),
    laterRow('arrangement', '구성', {submenu: true}),
    laterRow('destination', '출력 대상', {submenu: true}),
    menuSeparator('edit-separator'),
    {
      kind: 'item',
      id: 'lyrics',
      label: '곡 편집',
      ...menuAvailability(busy ? '곡 작업 중' : undefined),
      onSelect: open,
    },
    menuSeparator('clipboard-separator'),
    laterRow('copy', '복사', {icon: 'copy'}),
    laterRow('paste', '붙여넣기', {icon: 'paste'}),
    laterRow('duplicate', '복제', {icon: 'duplicate'}),
    laterRow('rename', '이름 바꾸기'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      danger: true,
      ...menuAvailability(
        song.access === 'readOnly'
          ? '읽기 전용 곡입니다'
          : busy
            ? '곡 작업 중'
            : undefined,
      ),
      onSelect: remove,
    },
    menuSeparator('export-separator'),
    laterRow('reveal', '탐색기에서 보기'),
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '그림으로 내보내기…'),
  ];
}
