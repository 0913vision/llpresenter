import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {
  laterClipboardRows,
  laterRow,
  menuSeparator,
} from '@renderer/ui/menuRows';

/**
 * The menu of a slide tile in 진행: 출력, then 준비에서 열기 when the slide
 * can be edited there, then the commands still to come.
 */
export function slideMenuEntries({
  output,
  edit,
}: {
  readonly output: () => void;
  readonly edit: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'output',
      contextGroup: 'default',
      label: '출력',
      onSelect: output,
    },
    laterRow('quick-edit', '빠른 편집'),
    {
      kind: 'item',
      id: 'edit',
      contextGroup: 'default',
      label: '준비에서 열기',
      ...menuAvailability(
        edit === undefined
          ? '이 슬라이드는 준비에서 편집할 수 없습니다.'
          : undefined,
      ),
      onSelect: edit,
    },
    menuSeparator('disable-separator'),
    laterRow('disable', '사용 안 함'),
    menuSeparator('appearance-separator'),
    laterRow('theme', '테마', {submenu: true}),
    laterRow('transition', '전환 효과…'),
    laterRow('hot-key', '단축키…'),
    laterRow('next-timer', '다음 타이머로 넘기기…'),
    menuSeparator('actions-separator'),
    laterRow('add-action', '동작 추가', {submenu: true}),
    laterRow('add-media-action', '미디어 동작 추가…'),
    menuSeparator('label-separator'),
    laterRow('group', '이름표', {submenu: true}),
    laterRow('label', '슬라이드 이름', {submenu: true}),
    menuSeparator('style-separator'),
    laterRow('copy-style', '글자 모양 복사'),
    laterRow('paste-style', '글자 모양 붙여넣기'),
    menuSeparator('clipboard-separator'),
    ...laterClipboardRows(),
    laterRow('delete', '삭제', {icon: 'trash'}),
  ];
}
