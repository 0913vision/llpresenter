import {
  isItemOfKind,
  serviceItemKind,
  type ServiceItem,
} from '../schema/service';
import {themeItemKinds, type ThemeItemKind} from './elementRules';

export function itemThemeKind(item: ServiceItem): ThemeItemKind | undefined {
  if (isItemOfKind(item, 'slides')) return item.slides.form;
  const kind = serviceItemKind(item);
  return themeItemKinds.find(candidate => candidate === kind);
}
