import type {ServiceItem} from '../schema/service';
import type {ThemeId} from '../schema/ids';
import {isStandaloneCard} from '../services/sectionCards';
import {isSectionTheme} from './sundaySections';

/** Section templates only belong to a standalone section card. */
export function canChooseItemTheme(item: ServiceItem, theme: ThemeId): boolean {
  return !isSectionTheme(theme) || isStandaloneCard(item);
}
