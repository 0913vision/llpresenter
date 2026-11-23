import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';

/**
 * The menu of a slide tile in 진행: 출력, and 준비에서 열기 when the slide can
 * be edited there. 진행 sends slides out; they are edited in 준비.
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
  ];
}
