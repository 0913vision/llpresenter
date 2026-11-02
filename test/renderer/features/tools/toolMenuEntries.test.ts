import {expect, it} from 'vitest';
import {menuItems} from '@renderer/ui/menuModel';
import {
  messageMenuEntries,
  namedToolMenuEntries,
  propMenuEntries,
  quickItemMenuEntries,
  toolMenuReason,
} from '@renderer/features/tools/toolMenuEntries';

it('keeps locked commands visible with a reason while future rows retain their own reason', () => {
  const noop = () => undefined;
  const reason = toolMenuReason(true, true);
  const menus = [
    propMenuEntries({edit: noop, remove: noop, reason}),
    messageMenuEntries({edit: noop, remove: noop, reason}),
    namedToolMenuEntries({rename: noop, remove: noop, reason}),
    quickItemMenuEntries({rename: noop, remove: noop, reason}),
  ];
  for (const entries of menus) {
    for (const item of menuItems(entries)) {
      expect(item.disabled).toBe(true);
      expect(item.title).toBe(
        item.onSelect ? '저장 중입니다' : '이번 버전에서는 쓸 수 없음',
      );
    }
  }
  expect(toolMenuReason(true)).toBe('목록이 잠겨 있습니다');
  expect(toolMenuReason(false, false)).toBeUndefined();
});
