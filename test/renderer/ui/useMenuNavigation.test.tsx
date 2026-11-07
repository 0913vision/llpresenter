import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {installMockClock} from '@fixtures/mockClock';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {describe, expect, it, vi} from 'vitest';
import {letTimePass, pointAway} from '@fixtures/renderer/ui/tooltipTesting';
import {
  Harness,
  installMenuTestHooks,
  openMenu,
  pointedName,
  pointAt,
  twoSubmenus,
} from '@fixtures/renderer/ui/menuTesting';
const SUBMENU_DELAY_MS = 400;
const SUBMENU_GRACE_MS = 400;

installMenuTestHooks();

describe('useMenuNavigation', () => {
  it.each([1, 2])(
    'cancels %s ancestor exit timers when keyboard navigation takes over',
    async levels => {
      let entries: readonly MenuEntry[] = [
        {kind: 'item', id: 'run', label: '실행'},
      ];
      for (let level = levels; level > 0; level--) {
        entries = [
          {
            kind: 'item',
            id: `level-${level}`,
            label: `메뉴 ${level}`,
            submenu: entries,
          },
        ];
      }
      render(<Harness entries={entries} />);
      await openMenu();
      const clock = installMockClock();
      let child = screen.getByRole('menu', {name: '파일'});
      for (let level = 1; level <= levels; level++) {
        pointAt(screen.getByRole('menuitem', {name: `메뉴 ${level}`}));
        await letTimePass(clock, SUBMENU_DELAY_MS);
        child = screen.getByRole('menu', {name: `메뉴 ${level}`});
        pointAt(child);
      }
      pointAway(child);
      await letTimePass(clock, SUBMENU_GRACE_MS - 1);
      fireEvent.keyDown(child, {key: 'ArrowDown'});
      await letTimePass(clock, SUBMENU_GRACE_MS * 2);
      expect(screen.getAllByRole('menu')).toHaveLength(levels + 1);
      expect(document.activeElement).toBe(child);
      expect(
        screen
          .getByRole('menuitem', {name: '실행'})
          .getAttribute('data-pointed'),
      ).toBe('true');
      pointAt(child);
      pointAway(child);
      await letTimePass(clock, SUBMENU_GRACE_MS);
      expect(screen.getAllByRole('menu')).toHaveLength(1);
    },
  );
  it.each(['내보내기', '인쇄', '사용 불가'])(
    'removes the expanded parent highlight immediately on entering %s',
    async label => {
      render(
        <Harness
          entries={[
            ...twoSubmenus,
            {
              kind: 'item',
              id: 'disabled',
              label: '사용 불가',
              disabled: true,
              title: '사용할 수 없음',
            },
          ]}
        />,
      );
      await openMenu();
      const clock = installMockClock();
      const parent = screen.getByRole('menuitem', {name: '가져오기'});
      pointAt(parent);
      await letTimePass(clock, SUBMENU_DELAY_MS);
      expect(parent.getAttribute('data-submenu-highlighted')).toBe('true');
      pointAway(parent);
      pointAt(screen.getByRole('menuitem', {name: label}));
      expect(parent.getAttribute('aria-expanded')).toBe('true');
      expect(parent.getAttribute('data-submenu-highlighted')).toBe('false');
      await letTimePass(clock, SUBMENU_DELAY_MS - 1);
      expect(parent.getAttribute('data-submenu-highlighted')).toBe('false');
      expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
      pointAt(screen.getByRole('menu', {name: '가져오기'}));
      expect(parent.getAttribute('data-submenu-highlighted')).toBe('true');
      await letTimePass(clock, SUBMENU_DELAY_MS * 2);
      expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
    },
  );

  it.each(['pointer', 'keyboard'])(
    'keeps ancestors after %s opening, then closes when the pointer leaves',
    async opener => {
      render(
        <Harness
          entries={[
            {
              kind: 'item',
              id: 'first',
              label: '첫 메뉴',
              submenu: [
                {
                  kind: 'item',
                  id: 'second',
                  label: '둘째 메뉴',
                  submenu: [{kind: 'item', id: 'last', label: '마지막'}],
                },
              ],
            },
          ]}
        />,
      );
      await openMenu();
      const clock = installMockClock();
      const first = screen.getByRole('menuitem', {name: '첫 메뉴'});
      if (opener === 'pointer') {
        pointAt(first);
        await letTimePass(clock, SUBMENU_DELAY_MS);
      } else {
        fireEvent.keyDown(screen.getByRole('menu', {name: '파일'}), {
          key: 'ArrowRight',
        });
      }
      const second = screen.getByRole('menuitem', {name: '둘째 메뉴'});
      pointAway(first);
      pointAt(second);
      await letTimePass(clock, SUBMENU_DELAY_MS);
      const menu = screen.getByRole('menu', {name: '둘째 메뉴'});
      pointAway(screen.getByRole('menu', {name: '첫 메뉴'}));
      pointAt(menu);
      await letTimePass(clock, SUBMENU_DELAY_MS * 2);
      expect(screen.getAllByRole('menu')).toHaveLength(3);
      expect(first.getAttribute('data-submenu-highlighted')).toBe('true');
      expect(second.getAttribute('data-submenu-highlighted')).toBe('true');
      pointAway(menu);
      await letTimePass(clock, SUBMENU_DELAY_MS);
      expect(screen.getAllByRole('menu')).toHaveLength(1);
    },
  );
  it.each(['ArrowLeft', 'Escape'])(
    'restores the parent after pointer entry and %s, then supports Right and Down',
    async key => {
      render(<Harness entries={twoSubmenus} />);
      await openMenu();
      const clock = installMockClock();
      const parent = screen.getByRole('menuitem', {name: '가져오기'});
      pointAt(parent);
      await letTimePass(clock, SUBMENU_DELAY_MS);
      const child = screen.getByRole('menu', {name: '가져오기'});
      pointAt(child);
      fireEvent.keyDown(child, {key});
      expect(parent.getAttribute('data-pointed')).toBe('true');
      const root = screen.getByRole('menu', {name: '파일'});
      expect(document.activeElement).toBe(root);
      fireEvent.keyDown(root, {key: 'ArrowRight'});
      expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
      fireEvent.keyDown(screen.getByRole('menu', {name: '가져오기'}), {key});
      fireEvent.keyDown(root, {key: 'ArrowDown'});
      expect(
        screen
          .getByRole('menuitem', {name: '내보내기'})
          .getAttribute('data-pointed'),
      ).toBe('true');
    },
  );
  it('keeps the expanded parent only during the pointer travel delay', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const clock = installMockClock();
    const parent = screen.getByRole('menuitem', {name: '가져오기'});
    const next = screen.getByRole('menuitem', {name: '내보내기'});
    pointAt(parent);
    await letTimePass(clock, SUBMENU_DELAY_MS);
    pointAway(parent);
    expect(pointedName()).toBeNull();
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    pointAt(next);
    expect(next.getAttribute('data-pointed')).toBe('true');
    expect(parent.getAttribute('data-pointed')).toBe('false');
    pointAway(next);
    await letTimePass(clock, SUBMENU_DELAY_MS * 2);
    expect(pointedName()).toBeNull();
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    expect(next.getAttribute('data-pointed')).toBe('false');
  });
  it('clears pointer pointing on leaving a row for a separator or leaving the menu', async () => {
    render(<Harness />);
    await openMenu();
    const row = screen.getByRole('menuitem', {name: '예배 열기'});
    pointAt(row);
    pointAway(row);
    expect(pointedName()).toBeNull();
    pointAt(row);
    pointAway(screen.getByRole('menu'));
    expect(pointedName()).toBeNull();
  });

  it('keeps keyboard pointing until the pointer moves, even when a stationary pointer enters or leaves', async () => {
    render(<Harness />);
    await openMenu();
    await userEvent.keyboard('{ArrowDown}');
    const name = pointedName();
    const row = screen.getByRole('menuitem', {name: '삭제'});
    fireEvent.pointerOver(row);
    pointAway(row);
    expect(pointedName()).toBe(name);
    pointAt(row);
    expect(pointedName()).toBe(row.textContent);
    pointAway(row);
    expect(pointedName()).toBeNull();
  });

  it('cancels a pending submenu on leave and keeps an already open parent marked', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const clock = installMockClock();
    const row = screen.getByRole('menuitem', {name: '가져오기'});
    pointAt(row);
    pointAway(row);
    await letTimePass(clock, SUBMENU_DELAY_MS);
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    pointAt(row);
    await letTimePass(clock, SUBMENU_DELAY_MS);
    pointAway(row);
    expect(row.getAttribute('data-pointed')).toBe('false');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(screen.getByRole('menu', {name: '가져오기'}), {
      key: 'Escape',
    });
    pointAt(row);
    await letTimePass(clock, SUBMENU_DELAY_MS);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
  });

  it('moves with the arrows, wraps, and goes to the ends', async () => {
    render(<Harness />);
    await openMenu();
    await userEvent.keyboard('{ArrowUp}');
    expect(pointedName()).toBe('삭제');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(pointedName()).toBe('예배 열기');
    await userEvent.keyboard('{End}');
    expect(pointedName()).toBe('삭제');
    await userEvent.keyboard('{Home}');
    expect(pointedName()).toBe('새 예배Ctrl N');
  });

  it('passes modified navigation and activation without running an item', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Harness onSelect={onSelect} onClose={onClose} />);
    await openMenu();
    const menu = screen.getByRole('menu');
    const initial = pointedName();
    const onKeyDown = vi.fn();
    window.addEventListener('keydown', onKeyDown);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of ['ArrowDown', 'Home', 'Enter', ' ', 'Escape']) {
        expect(fireEvent.keyDown(menu, {key, [modifier]: true})).toBe(true);
        expect(pointedName()).toBe(initial);
      }
    }
    window.removeEventListener('keydown', onKeyDown);
    expect(onKeyDown).toHaveBeenCalledTimes(20);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('points to a disabled item but does not run it', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await openMenu();
    const backup = screen.getByRole('menuitem', {name: '백업'});
    expect(backup.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(pointedName()).toBe('백업');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(backup);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('points to the first item again when the search term changes', async () => {
    function Searching(): JSX.Element {
      const [value, setValue] = useState('');
      return (
        <Harness
          search={{value, onChange: setValue}}
          entries={[
            {kind: 'item', id: 'a', label: '가'},
            {kind: 'item', id: 'b', label: '나'},
            {kind: 'item', id: 'c', label: '다'},
          ]}
        />
      );
    }
    render(<Searching />);
    await openMenu();
    const field = screen.getByRole('combobox');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(field.getAttribute('aria-activedescendant')).toContain('item-2');
    await userEvent.keyboard('x');
    expect(field.getAttribute('aria-activedescendant')).toContain('item-0');
  });

  it('keeps the menu open after an item that keeps it open runs', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <Harness
        onClose={onClose}
        entries={[
          {kind: 'item', id: 'mode', label: '모드', keepsOpen: true, onSelect},
          {kind: 'item', id: 'plain', label: '보통'},
        ]}
      />,
    );
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', {name: '모드'}));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeDefined();
    await userEvent.click(screen.getByRole('menuitem', {name: '보통'}));
    expect(onClose).toHaveBeenCalledWith('select');
  });

  it('runs an item on click', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    expect(onSelect).toHaveBeenCalledWith('delete');
  });

  it('closes on Esc without letting the key through', async () => {
    const onClose = vi.fn();
    const onOuterKey = vi.fn();
    render(
      <div
        onKeyDown={event => {
          onOuterKey(event.key);
        }}
      >
        <Harness onClose={onClose} />
      </div>,
    );
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith('escape');
    expect(onOuterKey).not.toHaveBeenCalledWith('Escape');
  });

  it('goes to the next item that starts with a typed letter', async () => {
    render(<Harness />);
    await openMenu();
    await userEvent.keyboard('삭');
    expect(pointedName()).toBe('삭제');
  });

  it('opens a submenu with the right arrow and closes it with the left', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Harness onSelect={onSelect} onClose={onClose} />);
    await openMenu();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const parent = screen.getByRole('menuitem', {name: '가져오기'});
    expect(parent.getAttribute('aria-haspopup')).toBe('menu');
    await userEvent.keyboard('{ArrowRight}');
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    const submenu = screen.getByRole('menu', {name: '가져오기'});
    expect(document.activeElement).toBe(submenu);
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('menu', {name: '파일'}),
    );

    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('clip');
    expect(onClose).toHaveBeenCalledWith('select');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a submenu when the pointer rests on its parent for 400ms', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', {name: '파일'}));
    const clock = installMockClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS - 1);
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    await letTimePass(clock, 1);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
  });

  it('closes only a submenu that the pointer opened on Esc', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const root = screen.getByRole('menu', {name: '파일'});
    const clock = installMockClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS);
    expect(document.activeElement).toBe(root);
    fireEvent.keyDown(root, {key: 'Escape'});
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    expect(document.activeElement).toBe(root);
    fireEvent.keyDown(root, {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves focus into the submenu that the pointer enters', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const clock = installMockClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS);
    const submenu = screen.getByRole('menu', {name: '가져오기'});
    pointAt(submenu);
    expect(document.activeElement).toBe(submenu);
    fireEvent.keyDown(submenu, {key: 'Escape'});
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('menu', {name: '파일'}),
    );
  });

  it('keeps an open submenu while the pointer crosses another parent into it', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const clock = installMockClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS);
    pointAt(screen.getByRole('menuitem', {name: '내보내기'}));
    await letTimePass(clock, SUBMENU_GRACE_MS - 1);
    pointAt(screen.getByRole('menu', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_GRACE_MS * 2);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
    expect(screen.queryByRole('menu', {name: '내보내기'})).toBeNull();
  });

  it('opens the next submenu once the grace period ends', async () => {
    render(<Harness entries={twoSubmenus} />);
    await openMenu();
    const clock = installMockClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS);
    pointAt(screen.getByRole('menuitem', {name: '내보내기'}));
    await letTimePass(clock, SUBMENU_GRACE_MS - 1);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
    await letTimePass(clock, 1);
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    expect(screen.getByRole('menu', {name: '내보내기'})).toBeDefined();
  });

  it.each(['row', 'menu'])(
    'cancels the pending switch and closes after leaving the %s',
    async target => {
      render(<Harness entries={twoSubmenus} />);
      await openMenu();
      const clock = installMockClock();
      pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
      await letTimePass(clock, SUBMENU_DELAY_MS);
      const next = screen.getByRole('menuitem', {name: '내보내기'});
      pointAt(next);
      await letTimePass(clock, SUBMENU_GRACE_MS - 1);
      pointAway(
        target === 'row' ? next : screen.getByRole('menu', {name: '파일'}),
      );
      await letTimePass(clock, SUBMENU_GRACE_MS);
      expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
      expect(screen.queryByRole('menu', {name: '내보내기'})).toBeNull();
    },
  );

  it('leaves the keys of a Korean composition to the IME', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <Harness
        onSelect={onSelect}
        onClose={onClose}
        search={{value: '', onChange: () => {}}}
      />,
    );
    await openMenu();
    const field = screen.getByRole('combobox', {name: '검색'});
    fireEvent.keyDown(field, {key: 'ArrowDown', isComposing: true});
    fireEvent.keyDown(field, {key: 'Enter', isComposing: true});
    fireEvent.keyDown(field, {key: 'Escape', isComposing: true});
    const pointed = field.getAttribute('aria-activedescendant') ?? '';
    expect(document.getElementById(pointed)?.textContent).toBe('새 예배Ctrl N');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(field, {key: 'Enter'});
    expect(onSelect).toHaveBeenCalledWith('new');
  });
});
