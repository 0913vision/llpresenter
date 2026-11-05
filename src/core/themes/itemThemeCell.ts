import type {ServiceItem} from '../schema/service';
import type {ThemesFile} from '../schema/themes';
import {itemThemeKind} from './itemKind';
import {resolveItemTheme} from './resolve';

/** What the 테마 column of the 예배 순서 table shows for an item. */
export interface ItemThemeCell {
  readonly name: string;
  /** The item has no 테마 of its own, so it follows its kind's default. */
  readonly followsDefault: boolean;
}

/**
 * The 테마 an item draws with: its own choice, or the default of its kind. An
 * item whose chosen 테마 is gone also follows the default. Items with no 테마
 * (구역, unknown kinds) have no cell.
 */
export function itemThemeCell(
  item: ServiceItem,
  file: ThemesFile | null,
): ItemThemeCell | undefined {
  const kind = itemThemeKind(item);
  if (kind === undefined) return undefined;
  const chosen = file?.themes.find(theme => theme.id === item.theme);
  const theme = resolveItemTheme({
    file,
    kind,
    source: 'service',
    ...(item.theme === undefined ? {} : {theme: item.theme}),
  });
  return {name: theme.name, followsDefault: chosen === undefined};
}
