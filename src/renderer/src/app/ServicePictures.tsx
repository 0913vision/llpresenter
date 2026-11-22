import {useEffect} from 'react';
import type {ThemesFile} from '@core/schema/themes';
import type {ShowTile} from '@core/schema/showService';
import type {ServiceRow} from '@core/presentation/model';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {previewMediaOf} from '@renderer/rendering/previewMedia';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useShow} from '@renderer/session/show';
import {keepThumbnails} from '@renderer/ui/keptThumbnails';

/** Every picture file the themes place as an image element. */
function themeImages(file: ThemesFile): readonly string[] {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const each of value) walk(each);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const kind: unknown = Reflect.get(value, 'kind');
    const mediaId: unknown = Reflect.get(value, 'mediaId');
    if (kind === 'image' && typeof mediaId === 'string') {
      found.add(mediaUrl(mediaId));
    }
    for (const each of Object.values(value)) walk(each);
  };
  walk(file);
  return [...found];
}

function serviceMedia(
  rows: readonly ServiceRow[],
  tiles: Readonly<Record<string, readonly ShowTile[]>>,
): readonly string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if ('background' in row && row.background !== undefined) {
      ids.add(row.background.mediaId);
    }
    for (const tile of tiles[row.id] ?? []) {
      if (tile.media !== undefined) ids.add(tile.media.mediaId);
      if (tile.picture !== undefined) ids.add(tile.picture);
    }
  }
  return [...ids];
}

/**
 * Loads the pictures the open service and the themes use ahead, so a slide is
 * drawn with its picture in its first frame wherever it shows.
 */
export function ServicePictures(): null {
  const rows = useShow(view => view.rows);
  const tiles = useShow(view => view.tiles);
  const themes = useApiSettingsDocument({
    api: window.llp,
    name: 'themes',
    title: '테마',
  });
  const file = themes?.value;
  useEffect(() => {
    if (file !== undefined) keepThumbnails(themeImages(file));
  }, [file]);
  useEffect(() => {
    const media = previewMediaOf(window.llp);
    for (const id of serviceMedia(rows, tiles)) {
      media?.url(id).then(
        url => keepThumbnails([url]),
        () => undefined,
      );
    }
  }, [rows, tiles]);
  return null;
}
