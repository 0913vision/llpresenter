import {fireEvent, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, beforeAll} from 'vitest';
import {Menu, type MenuCloseReason, type MenuSearch} from '../Menu';
import type {MenuEntry} from '../menuModel';
import {resetTooltips} from '../tooltipTesting';

/** Installs the existing menu scroll and tooltip cleanup hooks. */
export function installMenuTestHooks(): void {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });
  afterEach(resetTooltips);
}

/** Moves the pointer over an element as the shared menu tests do. */
export function pointAt(element: Element): void {
  fireEvent.pointerOver(element, {pointerType: 'mouse'});
  fireEvent.pointerMove(element, {pointerType: 'mouse'});
}

/** The two submenu parents used to check pointer grace and cancellation. */
export const twoSubmenus: readonly MenuEntry[] = [
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

/** Opens the public menu with the existing file-menu fixture. */
export function Harness({
  onSelect = () => undefined,
  onClose = () => undefined,
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

/** Reads the active item of the deepest open menu. */
export function pointedName(): string | null {
  const menu = screen.getAllByRole('menu').at(-1);
  const id = menu?.getAttribute('aria-activedescendant') ?? '';
  return document.getElementById(id)?.textContent ?? null;
}

/** Opens the file-menu fixture by clicking its button. */
export async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByRole('button', {name: '파일'}));
}
