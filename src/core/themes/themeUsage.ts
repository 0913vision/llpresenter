import type {ThemeId} from '../schema/ids';
import type {ServiceItem} from '../schema/service';
import type {ThemesFile} from '../schema/themes';
import {itemThemeKind} from './itemKind';

/** Whether a 테마 sets an item's output, by choice or as its kind's default. */
export function itemUsesTheme(
  item: ServiceItem,
  themeId: ThemeId,
  defaults: ThemesFile['defaults'],
): boolean {
  if (item.theme === themeId) return true;
  const kind = itemThemeKind(item);
  return (
    item.theme === undefined && kind !== undefined && defaults[kind] === themeId
  );
}
