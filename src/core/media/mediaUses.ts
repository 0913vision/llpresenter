import type {MediaId} from '../schema/ids';
import type {GroupedSong} from '../schema/groupedSong';
import type {MediaList} from '../schema/mediaList';
import type {MediaUses} from '../schema/mediaUses';
import type {MacrosFile} from '../schema/macros';
import type {PropsFile} from '../schema/props';
import type {ThemesFile} from '../schema/themes';
import {isItemOfKind, type Service} from '../schema/service';

/** The documents that can use a media item. */
export interface MediaUseSources {
  readonly media: MediaList;
  readonly props: PropsFile;
  readonly themes: ThemesFile;
  readonly macros: MacrosFile;
  readonly songs: readonly GroupedSong[];
  readonly services: readonly Service[];
}

/**
 * Counts the places that use a media item, for the delete question (spec 08,
 * "Deleting a media item that is in use").
 */
export function countMediaUses(
  mediaId: MediaId,
  sources: MediaUseSources,
): MediaUses {
  const playlists = [
    ...sources.media.playlists,
    ...sources.media.audioPlaylists,
  ].filter(playlist => playlist.items.includes(mediaId)).length;
  const serviceItems = sources.services.reduce(
    (total, service) =>
      total +
      service.order.filter(
        item =>
          (isItemOfKind(item, 'song') && item.background === mediaId) ||
          (isItemOfKind(item, 'media') && item.media === mediaId),
      ).length,
    0,
  );
  const itemOverlays = sources.services.reduce(
    (total, service) =>
      total +
      service.order.reduce(
        (count, item) =>
          count +
          (item.overlays ?? []).filter(
            overlay =>
              'media' in overlay.content && overlay.content.media === mediaId,
          ).length,
        0,
      ),
    0,
  );
  const themes = [sources.themes.standby, ...sources.themes.themes].filter(
    theme =>
      Object.values(theme.screens).some(layout =>
        layout.elements.some(
          element => element.kind === 'image' && element.mediaId === mediaId,
        ),
      ),
  ).length;
  const macros = sources.macros.macros.filter(macro =>
    macro.actions.some(action => 'media' in action && action.media === mediaId),
  ).length;
  return {
    itemOverlays,
    themes,
    macros,
    playlists,
    graphics: sources.props.props.filter(
      prop => prop.content.kind === 'image' && prop.content.media === mediaId,
    ).length,
    songBackgrounds: sources.songs.filter(song => song.background === mediaId)
      .length,
    serviceItems,
  };
}
