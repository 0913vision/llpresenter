import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {Menu, type MenuCloseReason, type MenuSearch} from './Menu';
import type {MenuEntry} from './menuModel';
import {maxPopoverHeight} from './placement';
import {installFakeClock} from '../../../../test/fake-clock';
import {letTimePass, pointAt, resetTooltips} from './tooltipTesting';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(resetTooltips);

const SUBMENU_DELAY_MS = 150;
const SUBMENU_GRACE_MS = 300;
const SMALL_WINDOW_HEIGHT = 300;

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

async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByRole('button', {name: '파일'}));
}

describe('Menu', () => {
  it('opens as a named menu with focus on it and the first item pointed', async () => {
    render(<Harness />);
    await openMenu();
    const menu = screen.getByRole('menu', {name: '파일'});
    expect(document.activeElement).toBe(menu);
    expect(pointedName()).toBe('새 예배Ctrl N');
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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
    pointAt(screen.getByRole('menuitem', {name: '가져오기'}));
    await letTimePass(clock, SUBMENU_DELAY_MS);
    pointAt(screen.getByRole('menuitem', {name: '내보내기'}));
    await letTimePass(clock, SUBMENU_GRACE_MS - 1);
    expect(screen.getByRole('menu', {name: '가져오기'})).toBeDefined();
    await letTimePass(clock, 1);
    expect(screen.queryByRole('menu', {name: '가져오기'})).toBeNull();
    expect(screen.getByRole('menu', {name: '내보내기'})).toBeDefined();
  });

  it('fits itself again when the window shrinks, until it closes', async () => {
    render(<Harness />);
    await openMenu();
    const menu = screen.getByRole('menu', {name: '파일'});
    vi.stubGlobal('innerHeight', SMALL_WINDOW_HEIGHT);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(menu.style.maxHeight).toBe(
      `${maxPopoverHeight({width: window.innerWidth, height: SMALL_WINDOW_HEIGHT})}px`,
    );
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
