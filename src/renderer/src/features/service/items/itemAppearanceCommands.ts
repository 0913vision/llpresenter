import {isItemOfKind} from '@core/schema/service';
import {
  projectedItemOverlays,
  storedSongOverlays,
} from '@core/services/songItemOverlays';
import type {ThemeId} from '@core/schema/ids';
import {checkPart} from '@core/schema/fileFormat';
import {itemOverlaysSchema, type ItemOverlay} from '@core/schema/itemOverlays';
import {isStartItem, withItemTheme} from '@core/services/itemFieldChanges';
import type {ThemesFile} from '@core/schema/themes';
import type {ItemEditRequest, ItemTarget} from './itemEditQueue';
/** Captures the item theme override, preserving kind-default inheritance when omitted. */
export function themeRequest(
  target: ItemTarget | null,
  theme: ThemeId | undefined,
  themes?: ThemesFile | null,
): ItemEditRequest {
  return {
    target,
    failure: '테마 변경 실패',
    change: item => {
      if (!isStartItem(item)) return null;
      return withItemTheme(item, theme, themes);
    },
  };
}
/** Validates the changed overlays against the fresh item without replacing other fields. */
export function overlayRequest(
  target: ItemTarget | null,
  change: (rows: readonly ItemOverlay[]) => readonly ItemOverlay[],
): ItemEditRequest {
  return {
    target,
    failure: '오버레이 변경 실패',
    change: item => {
      if (!isStartItem(item)) return null;
      const rows = change(projectedItemOverlays(item));
      const checked = checkPart(itemOverlaysSchema, rows);
      if (!checked.ok) return null;
      const {overlays: removed, ...kept} = item;
      if (rows.length === 0) return kept;
      if (isItemOfKind(item, 'song')) {
        return {...item, overlays: storedSongOverlays(item, checked.value)};
      }
      const updated = {...item, overlays: checked.value};
      return updated;
    },
  };
}
