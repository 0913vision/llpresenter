import type {ThemeId} from '@core/schema/ids';
import {checkPart} from '@core/schema/fileFormat';
import {itemOverlaysSchema, type ItemOverlay} from '@core/schema/itemOverlays';
import {isStartItem} from '@core/services/itemFieldChanges';
import type {ItemEditRequest, ItemTarget} from './itemEditQueue';
/** Captures the item theme override, preserving kind-default inheritance when omitted. */
export function themeRequest(
  target: ItemTarget | null,
  theme: ThemeId | undefined,
): ItemEditRequest {
  return {
    target,
    failure: '테마 변경 실패',
    change: item => {
      if (!isStartItem(item)) return null;
      const updated = {...item};
      if (theme === undefined) delete updated.theme;
      else updated.theme = theme;
      return updated;
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
      const rows = change(item.overlays ?? []);
      const checked = checkPart(itemOverlaysSchema, rows);
      if (!checked.ok) return null;
      const updated = {...item};
      if (rows.length === 0) delete updated.overlays;
      else updated.overlays = checked.value;
      return updated;
    },
  };
}
