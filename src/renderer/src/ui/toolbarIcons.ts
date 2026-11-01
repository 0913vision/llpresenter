import type {IconSize} from './Icon';

const ICON_SIZE = 18 satisfies IconSize;
const ICON_SIZE_COMPACT = 16 satisfies IconSize;

/** The size of the down arrow on a toolbar button that opens a menu. */
export const TOOLBAR_CHEVRON_SIZE = 12 satisfies IconSize;

/** The icon size on the 56 toolbar, or on the 40 toolbar of a narrow window. */
export function toolbarIconSize(compact: boolean): IconSize {
  return compact ? ICON_SIZE_COMPACT : ICON_SIZE;
}
