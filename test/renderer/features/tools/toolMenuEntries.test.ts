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
  const copy = {duplicate: noop, duplicateReason: undefined};
  const reason = toolMenuReason(true, true);
  const menus = [
    propMenuEntries({...copy, edit: noop, remove: noop, reason}),
    messageMenuEntries({...copy, edit: noop, remove: noop, reason}),
    namedToolMenuEntries({...copy, rename: noop, remove: noop, reason}),
    quickItemMenuEntries({...copy, rename: noop, remove: noop, reason}),
  ];
  for (const entries of menus) {
    for (const item of menuItems(entries)) {
      expect(item.disabled).toBe(true);
      expect(item.title).toBe(item.onSelect ? '저장 중' : '아직 없는 기능');
    }
  }
  expect(toolMenuReason(true)).toBe('지금은 바꿀 수 없습니다');
  expect(toolMenuReason(false, false)).toBeUndefined();
});

it('turns 복제 on, and gives a full list its own reason after the lock reason', () => {
  const noop = () => undefined;
  const copyOf = (entries: ReturnType<typeof messageMenuEntries>) =>
    menuItems(entries).find(item => item.id === 'duplicate');
  const menus = [
    (duplicateReason: string | undefined, reason?: string) =>
      messageMenuEntries({
        edit: noop,
        duplicate: noop,
        duplicateReason,
        remove: noop,
        reason,
      }),
    (duplicateReason: string | undefined, reason?: string) =>
      propMenuEntries({
        edit: noop,
        duplicate: noop,
        duplicateReason,
        remove: noop,
        reason,
      }),
    (duplicateReason: string | undefined, reason?: string) =>
      namedToolMenuEntries({
        rename: noop,
        duplicate: noop,
        duplicateReason,
        remove: noop,
        reason,
      }),
    (duplicateReason: string | undefined, reason?: string) =>
      quickItemMenuEntries({
        rename: noop,
        duplicate: noop,
        duplicateReason,
        remove: noop,
        reason,
      }),
  ];
  for (const menu of menus) {
    expect(copyOf(menu(undefined))).toMatchObject({disabled: false});
    expect(copyOf(menu('목록이 가득 찼습니다'))).toMatchObject({
      disabled: true,
      title: '목록이 가득 찼습니다',
    });
    expect(copyOf(menu('목록이 가득 찼습니다', '저장 중'))).toMatchObject({
      disabled: true,
      title: '저장 중',
    });
  }
});
