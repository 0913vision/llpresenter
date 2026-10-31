import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {watchInputModality} from './inputModality';
import type {MenuEntry} from './menuModel';
import {maxPopoverHeight} from './placement';
import {cssRules} from '@renderer/ui/testing/cssRules';
import {Menu} from './Menu';
import {describe, expect, it, vi} from 'vitest';
import {pointAway} from './tooltipTesting';
import {
  Harness,
  installMenuTestHooks,
  openMenu,
  pointedName,
  pointAt,
} from './testing/menuTesting';
const SMALL_WINDOW = {width: 250, height: 500};
const OPENER_BOX = new DOMRect(100, 400, 80, 30);
const MENU_BOX = new DOMRect(0, 0, 200, 120);

installMenuTestHooks();

describe('MenuSurface', () => {
  it.each(['command', 'date'])(
    'keeps the %s inert during rename, then resumes menu pointing',
    async target => {
      const commit = vi.fn();
      const select = vi.fn();
      function RenamingMenu(): JSX.Element {
        const [editing, setEditing] = useState(true);
        return (
          <Menu
            label="목록"
            anchor={{kind: 'point', point: {x: 20, y: 20}}}
            onClose={vi.fn()}
            entries={[
              {
                kind: 'item',
                id: 'rename',
                label: '예배',
                meta: '11월 1일',
                onSelect: select,
                rename: editing
                  ? {
                      onCommit: name => {
                        commit(name);
                        return true;
                      },
                      onClose: () => setEditing(false),
                    }
                  : undefined,
              },
              {kind: 'item', id: 'new', label: '새 예배…', onSelect: select},
            ]}
          />
        );
      }
      render(<RenamingMenu />);
      const field = screen.getByRole('textbox', {name: '예배 이름'});
      fireEvent.change(field, {target: {value: '바뀐 예배'}});
      const other =
        target === 'command'
          ? screen.getByRole('menuitem', {name: '새 예배…'})
          : screen.getByText('11월 1일');
      pointAt(other);
      expect(
        other.closest('[role^="menuitem"]')?.getAttribute('data-pointed'),
      ).toBe('false');
      await userEvent.click(other);
      expect(commit).toHaveBeenCalledExactlyOnceWith('바뀐 예배');
      expect(select).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      pointAt(other);
      expect(
        other.closest('[role^="menuitem"]')?.getAttribute('data-pointed'),
      ).toBe('true');
      pointAway(other);
      expect(
        other.closest('[role^="menuitem"]')?.getAttribute('data-pointed'),
      ).toBe('false');
      const first = screen.getAllByRole('menuitem')[0];
      if (!first) throw new Error('Missing first row');
      fireEvent.keyDown(screen.getByRole('menu'), {key: 'Home'});
      fireEvent.pointerOver(other);
      pointAway(other);
      expect(first.getAttribute('data-pointed')).toBe('true');
      await userEvent.click(other);
      expect(select).toHaveBeenCalledOnce();
    },
  );

  it('builds deferred choices on opening, caches pointer moves, and releases them on closing', () => {
    const build = vi.fn((): readonly MenuEntry[] => [
      {kind: 'item', id: 'child', label: '대상'},
    ]);
    render(
      <Harness
        entries={[
          {kind: 'item', id: 'lazy', label: '동작', loadSubmenu: build},
          {kind: 'item', id: 'other', label: '다른 동작'},
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: '파일'}));
    const parent = screen.getByRole('menu', {name: '파일'});
    expect(build).not.toHaveBeenCalled();
    fireEvent.keyDown(parent, {key: 'ArrowRight'});
    expect(screen.getByRole('menuitem', {name: '대상'})).toBeDefined();
    expect(build).toHaveBeenCalledOnce();
    fireEvent.keyDown(parent, {key: 'ArrowDown'});
    expect(build).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole('menu', {name: '동작'}), {
      key: 'Escape',
    });
    expect(screen.queryByRole('menu', {name: '동작'})).toBeNull();
    fireEvent.keyDown(parent, {key: 'ArrowUp'});
    fireEvent.keyDown(parent, {key: 'ArrowRight'});
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('refreshes deferred choices after their source changes and skips disabled rows', () => {
    const build = vi.fn((): readonly MenuEntry[] => [
      {kind: 'item', id: 'child', label: '이전 대상'},
    ]);
    const {rerender} = render(
      <Harness
        entries={[
          {
            kind: 'item',
            id: 'lazy',
            label: '동작',
            loadSubmenu: build,
            disabled: true,
            title: '사용 불가',
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: '파일'}));
    const parent = screen.getByRole('menu', {name: '파일'});
    fireEvent.keyDown(parent, {key: 'ArrowRight'});
    expect(build).not.toHaveBeenCalled();
    rerender(
      <Harness
        entries={[
          {kind: 'item', id: 'lazy', label: '동작', loadSubmenu: build},
        ]}
      />,
    );
    fireEvent.keyDown(parent, {key: 'ArrowRight'});
    expect(screen.getByRole('menuitem', {name: '이전 대상'})).toBeDefined();
    rerender(
      <Harness
        entries={[
          {
            kind: 'item',
            id: 'lazy',
            label: '동작',
            loadSubmenu: () => [{kind: 'item', id: 'new', label: '새 대상'}],
          },
        ]}
      />,
    );
    expect(screen.queryByRole('menuitem', {name: '이전 대상'})).toBeNull();
    expect(screen.getByRole('menuitem', {name: '새 대상'})).toBeDefined();
  });

  it.each([
    {
      windowWidth: 1280,
      openerLeft: 1000,
      expected: ['1000px', '800px', '600px'],
    },
    {windowWidth: 700, openerLeft: 400, expected: ['408px', '208px', '8px']},
  ])(
    'keeps three menu levels separate and inside a $windowWidth window',
    ({windowWidth, openerLeft, expected}) => {
      vi.stubGlobal('innerWidth', windowWidth);
      vi.spyOn(
        HTMLElement.prototype,
        'getBoundingClientRect',
      ).mockImplementation(function (this: HTMLElement): DOMRect {
        if (this.getAttribute('role') === 'menu') {
          return new DOMRect(
            Number.parseFloat(this.style.left) || 0,
            100,
            200,
            120,
          );
        }
        if (this.tagName === 'BUTTON') {
          return new DOMRect(openerLeft, 50, 100, 30);
        }
        return new DOMRect(0, 110, 180, 28);
      });
      render(
        <Harness
          entries={[
            {
              kind: 'item',
              id: 'actions',
              label: '동작 추가',
              submenu: [
                {
                  kind: 'item',
                  id: 'clear',
                  label: '지우기',
                  submenu: [{kind: 'item', id: 'all', label: '모두 지우기'}],
                },
              ],
            },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole('button', {name: '파일'}));
      fireEvent.keyDown(screen.getByRole('menu', {name: '파일'}), {
        key: 'ArrowRight',
      });
      fireEvent.keyDown(screen.getByRole('menu', {name: '동작 추가'}), {
        key: 'ArrowRight',
      });
      expect(screen.getAllByRole('menu').map(menu => menu.style.left)).toEqual(
        expected,
      );
    },
  );

  it.each([undefined, 'radio', 'checkbox'] as const)(
    'reserves the check column only for checkable menus (%s)',
    async check => {
      render(
        <Harness entries={[{kind: 'item', id: 'a', label: '선택', check}]} />,
      );
      await openMenu();
      expect(screen.getByRole('menu').getAttribute('data-check-column')).toBe(
        String(check !== undefined),
      );
      expect(
        cssRules('src/renderer/src/ui/Menu.module.css')(
          ".menu[data-check-column='false'] .item",
        ),
      ).toContain('padding-left: var(--space-14)');
    },
  );

  it('moves the row highlight immediately without a background transition', async () => {
    expect(cssRules('src/renderer/src/ui/Menu.module.css')('.item')).toContain(
      'transition: none',
    );
    render(<Harness />);
    await openMenu();
    const first = screen.getByRole('menuitem', {name: /^새 예배/});
    const second = screen.getByRole('menuitem', {name: '예배 열기'});
    pointAt(second);
    expect(second.getAttribute('data-pointed')).toBe('true');
    expect(first.getAttribute('data-pointed')).toBe('false');
    pointAt(first);
    expect(first.getAttribute('data-pointed')).toBe('true');
    expect(second.getAttribute('data-pointed')).toBe('false');
  });

  it('opens as a named menu with focus on it and the first item pointed', async () => {
    render(<Harness />);
    await openMenu();
    const menu = screen.getByRole('menu', {name: '파일'});
    expect(document.activeElement).toBe(menu);
    expect(pointedName()).toBe('새 예배Ctrl N');
  });

  it('points nothing when the pointer opens it and the first item when a key does', async () => {
    const stopWatching = watchInputModality(window);
    try {
      render(<Harness />);
      await openMenu();
      expect(pointedName()).toBeNull();
      await userEvent.keyboard('{ArrowDown}');
      expect(pointedName()).toBe('새 예배Ctrl N');
      await userEvent.keyboard('{Escape}');
      screen.getByRole('button', {name: '파일'}).focus();
      await userEvent.keyboard('{Enter}');
      expect(pointedName()).toBe('새 예배Ctrl N');
    } finally {
      stopWatching();
    }
  });

  it('draws the part of a label that a search matched', async () => {
    render(
      <Harness
        entries={[
          {
            kind: 'item',
            id: 'song',
            label: '만복의 근원 하나님',
            match: {start: 4, end: 6},
          },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', {name: '파일'}));
    const item = screen.getByRole('menuitem', {name: '만복의 근원 하나님'});
    expect(within(item).getByText('근원').tagName).toBe('SPAN');
    expect(item.textContent).toBe('만복의 근원 하나님');
  });

  it('fits itself again when the window shrinks, until it closes', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement): DOMRect {
        if (this.getAttribute('role') === 'menu') return MENU_BOX;
        return this.textContent === '파일' ? OPENER_BOX : new DOMRect();
      },
    );
    render(<Harness />);
    await openMenu();
    const menu = screen.getByRole('menu', {name: '파일'});
    expect([menu.style.left, menu.style.top]).toEqual(['100px', '434px']);
    vi.stubGlobal('innerWidth', SMALL_WINDOW.width);
    vi.stubGlobal('innerHeight', SMALL_WINDOW.height);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(menu.style.maxHeight).toBe(`${maxPopoverHeight(SMALL_WINDOW)}px`);
    expect([menu.style.left, menu.style.top]).toEqual(['42px', '276px']);
    const removed = vi.spyOn(window, 'removeEventListener');
    await userEvent.keyboard('{Escape}');
    expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('marks the current choice and names a group', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);
    render(
      <Menu
        label="이름표"
        anchor={{kind: 'element', element: anchor}}
        onClose={() => {}}
        entries={[
          {kind: 'group', id: 'g', label: '이름표'},
          {
            kind: 'item',
            id: 'v1',
            label: '1절',
            check: 'radio',
            checked: true,
            swatch: 'teal',
          },
          {
            kind: 'item',
            id: 'ch',
            label: '후렴',
            check: 'radio',
            checked: false,
            swatch: 'rose',
          },
        ]}
      />,
    );
    expect(
      screen
        .getByRole('menuitemradio', {name: '1절'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitemradio', {name: '후렴'})
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByRole('group', {name: '이름표'})).toBeDefined();
    anchor.remove();
  });

  it('keeps focus in the search field and moves through the list from it', async () => {
    const onSelect = vi.fn();
    const onSearch = vi.fn();
    render(
      <Harness onSelect={onSelect} search={{value: '', onChange: onSearch}} />,
    );
    await openMenu();
    const field = screen.getByRole('combobox', {name: '검색'});
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard('주');
    expect(onSearch).toHaveBeenCalledWith('주');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
  });
});
