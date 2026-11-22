import {useMemo} from 'react';
import {placedOverlays, storedOverlays} from '@core/live';
import {hasSlides, type SlidesItem} from '@core/schema/service';
import {useMedia} from '@renderer/platform/media';
import {useThemes} from '@renderer/platform/themes';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {editItem, type OpenServiceResult} from '@renderer/session/openService';
import type {OverlayEditing} from './overlayEditing';

async function saved(edit: Promise<OpenServiceResult>): Promise<boolean> {
  const result = await edit;
  return result.ok || result.error.reason === 'write-failed';
}

/** What the clips of an item show and change. */
export function useItemOverlays(
  item: SlidesItem | undefined,
  readOnly: boolean,
): OverlayEditing {
  const screens = useThemes(view => view.screens);
  const media = useMedia(view => view.items);
  return useMemo(() => {
    const first = screens[0];
    return {
      overlays:
        item === undefined ? [] : placedOverlays(item.overlays, item.slides),
      count: item?.slides.length ?? 0,
      reason: readOnly ? NEWER_FILE_REASON : undefined,
      screens,
      defaultScreens: first === undefined ? [] : [first.id],
      media,
      change: change =>
        item === undefined
          ? Promise.resolve(false)
          : saved(
              editItem(item.id, current => {
                if (!hasSlides(current)) return null;
                const placed = change(
                  placedOverlays(current.overlays, current.slides),
                );
                const {overlays: _overlays, ...rest} = current;
                return placed.length === 0
                  ? rest
                  : {...rest, overlays: storedOverlays(placed, rest.slides)};
              }),
            ),
    };
  }, [item, readOnly, screens, media]);
}
