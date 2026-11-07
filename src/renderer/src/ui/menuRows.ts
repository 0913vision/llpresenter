import type {MenuItem, MenuSeparator} from './menuModel';

/** The tooltip on a row for a ProPresenter feature the app doesn't have yet. */
export const NOT_YET = '아직 없는 기능';

export function menuSeparator(id: string): MenuSeparator {
  return {kind: 'separator', id};
}

/**
 * A disabled row for a ProPresenter feature the app doesn't have yet, so the
 * menu keeps its final shape (spec 11). `submenu` draws the arrow.
 */
export function laterRow(
  id: string,
  label: string,
  options: {
    readonly icon?: string | undefined;
    readonly submenu?: boolean | undefined;
    /** A shortcut shown at the right, as ProPresenter shows it. */
    readonly meta?: string | undefined;
    readonly command?: string | undefined;
  } = {},
): MenuItem {
  return {
    kind: 'item',
    id,
    label,
    icon: options.icon,
    meta: options.meta,
    command: options.command,
    disabled: true,
    title: NOT_YET,
    submenu: options.submenu === true ? [] : undefined,
  };
}

/** ProPresenter's 잘라내기, 복사, 붙여넣기 rows, which the app doesn't have. */
export function laterClipboardRows(): readonly MenuItem[] {
  return [
    laterRow('cut', '잘라내기', {icon: 'scissors'}),
    laterRow('copy', '복사', {icon: 'copy'}),
    laterRow('paste', '붙여넣기', {icon: 'paste'}),
  ];
}
