import type {ThemeId} from '../schema/ids';
import type {ThemesFile} from '../schema/themes';
import {itemThemeKind} from '../themes/itemKind';
import {resolveItemTheme} from '../themes/resolve';
import {hasSectionCard} from './sectionCards';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
/**
 * Returns the changed item, the same item when nothing changes, or `null`
 * when the item can't take the change, such as a header asked for a 구성.
 */
export type ServiceItemChange = (item: ServiceItem) => ServiceItem | null;

const startKinds = ['song', 'bible', 'media', 'slides'] as const;
/** Item kinds that carry start actions, memos and appearance overrides. */
export type StartItem = ServiceItemOf<(typeof startKinds)[number]>;
type StartField = 'macro' | 'memo';

/** The items that run a start 매크로 and keep a memo (spec 02). */
export function isStartItem(item: ServiceItem): item is StartItem {
  return startKinds.some(kind => isItemOfKind(item, kind));
}

function setStartField(
  item: StartItem,
  field: StartField,
  value: string | undefined,
): StartItem {
  const updated = {...item};
  switch (field) {
    case 'macro':
      if (value === undefined) delete updated.macro;
      else updated.macro = value;
      break;
    case 'memo':
      if (value === undefined) delete updated.memo;
      else updated.memo = value;
      break;
  }
  return updated;
}

/** Changes one supported start field, retaining identity for an unchanged value. */
export function withStartField(
  field: StartField,
  value: string | undefined,
): ServiceItemChange {
  return item => {
    if (!isStartItem(item)) return null;
    return item[field] === value ? item : setStartField(item, field, value);
  };
}

/** Updates an item's theme and its section card in one item edit. */
export function withItemTheme(
  item: ServiceItemOf<'slides'>,
  theme: ThemeId | undefined,
  themes: ThemesFile | null | undefined,
): ServiceItemOf<'slides'>;
export function withItemTheme(
  item: StartItem,
  theme: ThemeId | undefined,
  themes: ThemesFile | null | undefined,
): StartItem;
export function withItemTheme(
  item: StartItem,
  theme: ThemeId | undefined,
  themes: ThemesFile | null | undefined,
): StartItem {
  const {theme: _previousTheme, ...withoutTheme} = item;
  const updated = theme === undefined ? withoutTheme : {...withoutTheme, theme};
  if (hasSectionCard(updated)) {
    const kind = itemThemeKind(updated);
    if (kind !== undefined) {
      const effective =
        theme ?? resolveItemTheme({file: themes, kind, source: 'external'}).id;
      return {
        ...updated,
        sectionCard: {...updated.sectionCard, theme: effective},
      };
    }
  }
  return updated;
}
