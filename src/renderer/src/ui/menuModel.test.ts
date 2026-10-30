import {describe, expect, it} from 'vitest';
import {
  hasIconColumn,
  menuBlocks,
  menuItemRole,
  menuItems,
  movePointer,
  typeaheadTarget,
  type MenuEntry,
  type MenuItem,
} from './menuModel';

const item = (label: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  kind: 'item',
  id: label,
  label,
  ...extra,
});

describe('menuItems', () => {
  it('keeps only the items, in order', () => {
    const entries: MenuEntry[] = [
      {kind: 'group', id: 'g', label: '최근 예배'},
      item('새 예배'),
      {kind: 'separator', id: 's'},
      item('삭제'),
    ];
    expect(menuItems(entries).map(entry => entry.label)).toEqual([
      '새 예배',
      '삭제',
    ]);
  });
});

describe('hasIconColumn', () => {
  it('is needed when any item has an icon, never for a check mark', () => {
    expect(hasIconColumn([item('a'), item('b')])).toBe(false);
    expect(hasIconColumn([item('a'), item('b', {icon: 'filetext'})])).toBe(
      true,
    );
    expect(hasIconColumn([item('a', {check: 'radio', checked: true})])).toBe(
      false,
    );
  });
});

describe('movePointer', () => {
  it('wraps around the ends', () => {
    expect(movePointer(3, 2, 'next')).toBe(0);
    expect(movePointer(3, 0, 'previous')).toBe(2);
  });

  it('starts from the ends when nothing is pointed', () => {
    expect(movePointer(3, -1, 'next')).toBe(0);
    expect(movePointer(3, -1, 'previous')).toBe(2);
  });

  it('goes to the first and last items', () => {
    expect(movePointer(4, 1, 'first')).toBe(0);
    expect(movePointer(4, 1, 'last')).toBe(3);
  });

  it('points to nothing in an empty menu', () => {
    expect(movePointer(0, -1, 'next')).toBe(-1);
  });
});

describe('typeaheadTarget', () => {
  const items = [item('복사'), item('붙여넣기'), item('복제'), item('Save')];

  it('finds the next item that starts with the typed character', () => {
    expect(typeaheadTarget(items, 0, '복')).toBe(2);
    expect(typeaheadTarget(items, 2, '복')).toBe(0);
    expect(typeaheadTarget(items, -1, 's')).toBe(3);
  });

  it('finds nothing when no name matches', () => {
    expect(typeaheadTarget(items, 0, '가')).toBe(-1);
  });
});

describe('menuItemRole', () => {
  it('follows the check kind', () => {
    expect(menuItemRole(item('a'))).toBe('menuitem');
    expect(menuItemRole(item('a', {check: 'radio'}))).toBe('menuitemradio');
    expect(menuItemRole(item('a', {check: 'checkbox'}))).toBe(
      'menuitemcheckbox',
    );
  });
});

describe('menuBlocks', () => {
  it('gives each group name the items up to the next divider', () => {
    const entries: MenuEntry[] = [
      item('새 예배'),
      {kind: 'separator', id: 's1'},
      {kind: 'group', id: 'g', label: '최근 예배'},
      item('주일 예배'),
      item('수요 예배'),
      {kind: 'separator', id: 's2'},
      item('삭제'),
    ];
    expect(
      menuBlocks(entries).map(block =>
        block.kind === 'separator'
          ? '|'
          : `${block.kind === 'group' ? block.label : ''}[${block.items
              .map(entry => entry.label)
              .join(',')}]`,
      ),
    ).toEqual([
      '[새 예배]',
      '|',
      '최근 예배[주일 예배,수요 예배]',
      '|',
      '[삭제]',
    ]);
  });
});
