import type {ReactNode} from 'react';
import type {LabelColor} from '@shared/colors';
import type {SearchRange} from '@shared/searchText';

/** How an item that can be on reports it: one of several, or on and off. */
export type MenuCheckKind = 'radio' | 'checkbox';

/** A command, a choice, or the parent of a submenu. */
export interface MenuItem {
  readonly kind: 'item';
  readonly id: string;
  readonly label: string;
  /** The part of the label a search matched, drawn strong. */
  readonly match?: SearchRange | undefined;
  /** An 18px icon before the name. */
  readonly icon?: string | undefined;
  /** A noninteractive preview before the name, such as a monitor arrangement. */
  readonly preview?: ReactNode | undefined;
  /** A date or a shortcut at the right end, such as `Ctrl Z`. */
  readonly meta?: string | undefined;
  /** Makes it a choice; `checked` puts a check mark in the left padding. */
  readonly check?: MenuCheckKind | undefined;
  readonly checked?: boolean | undefined;
  /** An 이름표 color swatch before the name. */
  readonly swatch?: LabelColor | undefined;
  /** A delete item; it keeps the normal text color. */
  readonly danger?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the item is disabled. */
  readonly title?: string | undefined;
  readonly submenu?: readonly MenuEntry[] | undefined;
  readonly onSelect?: (() => void) | undefined;
  /** Keeps the menu open after the item runs, as a mode switch does. */
  readonly keepsOpen?: boolean | undefined;
}

export interface MenuSeparator {
  readonly kind: 'separator';
  readonly id: string;
}

export interface MenuGroupLabel {
  readonly kind: 'group';
  readonly id: string;
  readonly label: string;
}

export type MenuEntry = MenuItem | MenuSeparator | MenuGroupLabel;

/** The entries of a menu that the pointer and the arrow keys can reach. */
export function menuItems(entries: readonly MenuEntry[]): readonly MenuItem[] {
  return entries.filter((entry): entry is MenuItem => entry.kind === 'item');
}

/**
 * Whether the items between two dividers line up behind an icon column,
 * because at least one of them has an icon. Check marks sit in the left
 * padding and never need a column.
 */
export function hasIconColumn(items: readonly MenuItem[]): boolean {
  return items.some(item => item.icon !== undefined);
}

/** A move of the pointed item within a menu. */
export type MenuMove = 'next' | 'previous' | 'first' | 'last';

/**
 * The index a move lands on, wrapping around the ends. Disabled items can be
 * pointed to; they just don't run. Returns -1 for an empty menu.
 */
export function movePointer(
  count: number,
  from: number,
  move: MenuMove,
): number {
  if (count === 0) return -1;
  switch (move) {
    case 'next':
      return from < 0 ? 0 : (from + 1) % count;
    case 'previous':
      return from < 0 ? count - 1 : (from - 1 + count) % count;
    case 'first':
      return 0;
    case 'last':
      return count - 1;
  }
}

/**
 * The next item, after the pointed one, whose name starts with the typed
 * character, or -1 when none does.
 */
export function typeaheadTarget(
  items: readonly MenuItem[],
  from: number,
  typed: string,
): number {
  const key = typed.toLocaleLowerCase();
  for (let step = 1; step <= items.length; step++) {
    const index = (from + step + items.length) % items.length;
    if (items[index]?.label.toLocaleLowerCase().startsWith(key) === true) {
      return index;
    }
  }
  return -1;
}

/** The ARIA role of an item. */
export function menuItemRole(
  item: MenuItem,
): 'menuitem' | 'menuitemradio' | 'menuitemcheckbox' {
  switch (item.check) {
    case undefined:
      return 'menuitem';
    case 'radio':
      return 'menuitemradio';
    case 'checkbox':
      return 'menuitemcheckbox';
  }
}

/** Whether an item does something when it runs. */
export function isRunnable(item: MenuItem | undefined): item is MenuItem {
  return item !== undefined && item.disabled !== true;
}

/** A run of entries drawn together: a divider, a named group, or items. */
export type MenuBlock =
  | {readonly kind: 'separator'; readonly id: string}
  | {
      readonly kind: 'group';
      readonly id: string;
      readonly label: string;
      readonly items: readonly MenuItem[];
    }
  | {
      readonly kind: 'items';
      readonly id: string;
      readonly items: readonly MenuItem[];
    };

/**
 * Splits entries into blocks. A group name takes the items after it, up to
 * the next divider or group name.
 */
export function menuBlocks(
  entries: readonly MenuEntry[],
): readonly MenuBlock[] {
  const blocks: MenuBlock[] = [];
  let open: {id: string; label: string | undefined; items: MenuItem[]} | null =
    null;
  const close = (): void => {
    if (open === null) return;
    blocks.push(
      open.label === undefined
        ? {kind: 'items', id: open.id, items: open.items}
        : {kind: 'group', id: open.id, label: open.label, items: open.items},
    );
    open = null;
  };
  for (const entry of entries) {
    switch (entry.kind) {
      case 'separator':
        close();
        blocks.push(entry);
        break;
      case 'group':
        close();
        open = {id: entry.id, label: entry.label, items: []};
        break;
      case 'item':
        open ??= {id: entry.id, label: undefined, items: []};
        open.items.push(entry);
        break;
    }
  }
  close();
  return blocks;
}
