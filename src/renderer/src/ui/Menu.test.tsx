import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {watchInputModality} from './inputModality';
import {Menu, type MenuCloseReason, type MenuSearch} from './Menu';
import type {MenuEntry} from './menuModel';
import {maxPopoverHeight} from './placement';
import {cssRules} from '@renderer/ui/testing/cssRules';
import {installMockClock} from '../../../../test/mock-clock';
import {letTimePass, pointAway, resetTooltips} from './tooltipTesting';

function pointAt(element: Element): void {
  fireEvent.pointerOver(element, {pointerType: 'mouse'});
  fireEvent.pointerMove(element, {pointerType: 'mouse'});
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(resetTooltips);

const SUBMENU_DELAY_MS = 150;
const SUBMENU_GRACE_MS = 300;

it('retains an outside-blurred rename through a refused save and closes only after success', async () => {
  let finish: (saved: boolean) => void = () => undefined;
  const commit = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  const close = vi.fn();
  function RenameMenu() {
    const [editing, setEditing] = useState(true);
    return (
      <Menu
        label="목록"
        anchor={{kind: 'point', point: {x: 20, y: 20}}}
        onClose={close}
        entries={[
          {
            kind: 'item',
            id: 'name',
            label: '예배',
            rename: editing
              ? {
                  onCommit: commit,
                  onClose: () => setEditing(false),
                }
              : undefined,
          },
        ]}
      />
    );
  }
  render(<RenameMenu />);
  const field = screen.getByRole('textbox', {name: '예배 이름'});
  fireEvent.change(field, {target: {value: '바뀐 예배'}});
  const catcher = document.querySelector(
    '[data-llp-layer="popover"] > div > div',
  );
  if (!catcher) throw Error('Missing menu catcher');
  await userEvent.pointer({keys: '[MouseLeft>]', target: catcher});
  expect(commit).toHaveBeenCalledExactlyOnceWith('바뀐 예배');
  expect(close).not.toHaveBeenCalled();
  await act(async () => finish(false));
  expect(screen.getByDisplayValue('바뀐 예배')).toBe(field);
  expect(close).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}');
  expect(close).toHaveBeenCalledExactlyOnceWith('outside');
});

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
const SMALL_WINDOW = {width: 250, height: 500};
const OPENER_BOX = new DOMRect(100, 400, 80, 30);
const MENU_BOX = new DOMRect(0, 0, 200, 120);

const twoSubmenus: readonly MenuEntry[] = [
  {
    kind: 'item',
    id: 'import',
    label: '가져오기',
    submenu: [{kind: 'item', id: 'text', label: '텍스트 파일'}],
  },
  {
    kind: 'item',
    id: 'export',
    label: '내보내기',
    submenu: [{kind: 'item', id: 'pdf', label: 'PDF'}],
  },
  {kind: 'item', id: 'print', label: '인쇄'},
];

function fileMenu(onSelect: (id: string) => void): readonly MenuEntry[] {
  const item = (id: string, label: string, extra = {}): MenuEntry => ({
    kind: 'item',
    id,
    label,
    onSelect: () => onSelect(id),
    ...extra,
  });
  return [
    item('new', '새 예배', {meta: 'Ctrl N'}),
    item('open', '예배 열기'),
    {
      kind: 'item',
      id: 'import',
      label: '가져오기',
      submenu: [
        item('text', '텍스트 파일', {icon: 'filetext'}),
        item('clip', '클립보드 텍스트', {icon: 'copy'}),
      ],
    },
    item('backup', '백업', {disabled: true, title: '백업할 예배가 없습니다'}),
    {kind: 'separator', id: 'sep'},
    item('delete', '삭제', {danger: true}),
  ];
}

function Harness({
  onSelect = () => {},
  onClose = () => {},
  search,
  entries,
}: {
  readonly onSelect?: (id: string) => void;
  readonly onClose?: (reason: MenuCloseReason) => void;
  readonly search?: MenuSearch;
  readonly entries?: readonly MenuEntry[];
}): JSX.Element {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" ref={setOpener} onClick={() => setOpen(true)}>
        파일
      </button>
      {open && opener !== null ? (
        <Menu
          label="파일"
          entries={entries ?? fileMenu(onSelect)}
          anchor={{kind: 'element', element: opener}}
          search={search}
          onClose={reason => {
            setOpen(false);
            onClose(reason);
          }}
        />
      ) : null}
    </>
  );
}

function pointedName(): string | null {
  const menu = screen.getAllByRole('menu').at(-1);
  const id = menu?.getAttribute('aria-activedescendant') ?? '';
  return document.getElementById(id)?.textContent ?? null;
}

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
  fireEvent.keyDown(screen.getByRole('menu', {name: '동작'}), {key: 'Escape'});
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
      entries={[{kind: 'item', id: 'lazy', label: '동작', loadSubmenu: build}]}
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

async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByRole('button', {name: '파일'}));
}

describe('Menu', () => {
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
    expect(row.getAttribute('data-pointed')).toBe('true');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(screen.getByRole('menu', {name: '가져오기'}), {
      key: 'Escape',
    });
    pointAt(row);
    await letTimePass(clock, SUBMENU_DELAY_MS);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
  });

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

  it('runs the pointed item with Enter, closes, and returns focus', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Harness onSelect={onSelect} onClose={onClose} />);
    await openMenu();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(onClose).toHaveBeenCalledWith('select');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '파일'}),
    );
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

  it('closes on Tab and on a click outside', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openMenu();
    await userEvent.keyboard('{Tab}');
    expect(onClose).toHaveBeenLastCalledWith('tab');
    await openMenu();
    const catcher = document.querySelector(
      '[data-llp-layer="popover"] > div > div',
    );
    if (catcher === null) throw new Error('No click catcher');
    await userEvent.pointer({keys: '[MouseLeft>]', target: catcher});
    expect(onClose).toHaveBeenLastCalledWith('outside');
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

  it('opens a submenu when the pointer rests on its parent for 150ms', async () => {
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
    'cancels a pending submenu switch on leaving the %s',
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
      expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
      expect(screen.queryByRole('menu', {name: '내보내기'})).toBeNull();
    },
  );

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
