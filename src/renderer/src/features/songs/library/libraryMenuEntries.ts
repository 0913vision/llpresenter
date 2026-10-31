import type {LibrarySong} from '@core/schema/contentDocuments';
import type {MenuEntry} from '@renderer/ui/menuModel';
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
      disabled: busy || appendDisabledReason !== undefined,
      title: appendDisabledReason,
      onSelect: append,
    },
    laterRow('move-to', '라이브러리로 옮기기', {submenu: true}),
    menuSeparator('arrangement-separator'),
    laterRow('arrangement', '구성', {submenu: true}),
    laterRow('destination', '출력 대상', {submenu: true}),
    menuSeparator('edit-separator'),
    laterRow('resize', '크기 바꾸기', {submenu: true}),
    {
      kind: 'item',
      id: 'lyrics',
      label: '가사 편집',
      disabled: busy,
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
      disabled: busy || song.access === 'readOnly',
      title: song.access === 'readOnly' ? '읽기 전용 곡입니다' : undefined,
      onSelect: remove,
    },
    menuSeparator('export-separator'),
    laterRow('reveal', '탐색기에서 보기'),
    laterRow('export-bundle', '묶음으로 내보내기…'),
    laterRow('export-images', '그림으로 내보내기…'),
  ];
}
