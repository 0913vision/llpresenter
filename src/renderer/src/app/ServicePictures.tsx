import {useEffect} from 'react';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {ShowTile} from '@core/schema/showService';
import type {Themes} from '@core/schema/themes';
import {previewMediaOf} from '@renderer/rendering/previewMedia';
import {useThemes} from '@renderer/platform/themes';
import {useShow} from '@renderer/session/show';
import {keepThumbnails} from '@renderer/ui/keptThumbnails';

/** Every picture the themes place by themselves. */
function themePictures({themes}: Themes): readonly string[] {
  return [
    ...new Set(
      themes.flatMap(theme =>
        Object.values(theme.screens).flatMap(screen =>
          screen.mode === 'own'
            ? screen.elements.flatMap(element =>
                element.kind === 'picture' ? [mediaUrl(element.media)] : [],
              )
            : [],
        ),
      ),
    ),
  ];
}

function serviceMedia(
  tiles: Readonly<Record<string, readonly ShowTile[]>>,
): readonly string[] {
  const ids = Object.values(tiles).flatMap(list =>
    list.flatMap(({slide}) =>
      slide.background?.kind === 'media' ? [slide.background.media] : [],
    ),
  );
  return [...new Set(ids)];
}

/**
 * Loads the pictures the open service and the themes use ahead, so a slide is
 * drawn with its picture in its first frame wherever it shows.
 */
export function ServicePictures(): null {
  const tiles = useShow(view => view.tiles);
  const themes = useThemes(view => view.themes);
  useEffect(() => {
    if (themes !== null) keepThumbnails(themePictures(themes));
  }, [themes]);
  useEffect(() => {
    const media = previewMediaOf(window.llp);
    for (const id of serviceMedia(tiles)) {
      media?.url(id).then(
        url => keepThumbnails([url]),
        () => undefined,
      );
    }
  }, [tiles]);
  return null;
}
