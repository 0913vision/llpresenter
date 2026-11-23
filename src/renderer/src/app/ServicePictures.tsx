import {use, useEffect} from 'react';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import type {MediaItem} from '@core/schema/mediaList';
import type {ShowTile} from '@core/schema/showService';
import type {SlideBackground} from '@core/schema/theme';
import type {Themes} from '@core/schema/themes';
import {useMedia} from '@renderer/platform/media';
import {useThemes} from '@renderer/platform/themes';
import {useShow} from '@renderer/session/show';
import {keepThumbnails} from '@renderer/ui/keptThumbnails';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';

function mediaOf(background: SlideBackground | undefined): readonly string[] {
  return background?.kind === 'media' ? [background.media] : [];
}

/** Every picture the themes have by themselves. */
function themeMedia({themes}: Themes): readonly string[] {
  return themes.flatMap(theme => [
    ...mediaOf(theme.background),
    ...Object.values(theme.screens).flatMap(screen =>
      screen.mode === 'own'
        ? screen.elements.flatMap(element =>
            element.kind === 'picture' ? [element.media] : [],
          )
        : [],
    ),
  ]);
}

function serviceMedia(
  tiles: Readonly<Record<string, readonly ShowTile[]>>,
): readonly string[] {
  return Object.values(tiles).flatMap(list =>
    list.flatMap(({slide}) => mediaOf(slide.background)),
  );
}

/** The address a still has for each of these media. */
function pictures(
  ids: readonly string[],
  items: readonly MediaItem[],
): readonly string[] {
  const kinds = new Map<string, MediaItem['kind']>(
    items.map(item => [item.id, item.kind]),
  );
  return [...new Set(ids)].map(id =>
    kinds.get(id) === 'video' ? thumbnailUrl(id) : mediaUrl(id),
  );
}

/**
 * Loads the pictures the open service and the themes use ahead, so a slide is
 * drawn with its picture in its first frame wherever it shows. The launch
 * waits for them.
 */
export function ServicePictures(): null {
  const tiles = useShow(view => view.tiles);
  const themes = useThemes(view => view.themes);
  const items = useMedia(view => view.items);
  const readiness = use(LoadReadinessContext);
  useEffect(() => {
    if (themes === null) return;
    keepThumbnails(pictures(themeMedia(themes), items), readiness?.begin);
  }, [themes, items, readiness]);
  useEffect(() => {
    keepThumbnails(pictures(serviceMedia(tiles), items), readiness?.begin);
  }, [tiles, items, readiness]);
  return null;
}
