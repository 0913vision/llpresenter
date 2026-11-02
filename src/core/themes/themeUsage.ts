import type {ThemeId} from '../schema/ids';
import {serviceItemKind, type ServiceItem} from '../schema/service';
import type {ThemesFile} from '../schema/themes';
import {themeItemKinds, type ThemeItemKind} from './elementRules';

function themeKindOf(item: ServiceItem): ThemeItemKind | undefined {
  const kind = serviceItemKind(item);
  return themeItemKinds.find(themeKind => themeKind === kind);
}

/** Whether a 테마 sets an item's output, by choice or as its kind's default. */
export function itemUsesTheme(
  item: ServiceItem,
  themeId: ThemeId,
  defaults: ThemesFile['defaults'],
): boolean {
  if (item.theme === themeId) return true;
  const kind = themeKindOf(item);
  return (
    item.theme === undefined && kind !== undefined && defaults[kind] === themeId
  );
}
