import {menuAvailability} from '@renderer/ui/menuModel';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

interface MenuAction {
  readonly reason: string | undefined;
  readonly run: () => void;
}

interface PresetActions {
  readonly rename: MenuAction;
  readonly remove: MenuAction;
}

function actionRow(id: string, label: string, action: MenuAction): MenuItem {
  return {
    kind: 'item',
    id,
    label,
    ...menuAvailability(action.reason),
    onSelect: action.run,
  };
}

export function lookMenuEntries({
  apply,
  duplicate,
  rename,
  remove,
}: PresetActions & {
  readonly apply: MenuAction;
  readonly duplicate: MenuAction;
}): readonly MenuEntry[] {
  return [
    actionRow('apply', '지금 적용', apply),
    menuSeparator('apply-separator'),
    actionRow('duplicate', '복제', duplicate),
    actionRow('rename', '이름 바꾸기', rename),
    actionRow('delete', '삭제', remove),
  ];
}

export function lyricStyleMenuEntries({
  rename,
  remove,
}: PresetActions): readonly MenuEntry[] {
  return [
    actionRow('rename', '이름 바꾸기', rename),
    actionRow('delete', '삭제', remove),
  ];
}

export function stageLayoutMenuEntries({
  duplicate,
  rename,
  remove,
}: PresetActions & {readonly duplicate: MenuAction}): readonly MenuEntry[] {
  return [
    actionRow('duplicate', '복제', duplicate),
    actionRow('rename', '이름 바꾸기', rename),
    menuSeparator('delete-separator'),
    actionRow('delete', '삭제', remove),
  ];
}
