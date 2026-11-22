import type {MediaId} from '../schema/ids';
import type {Song} from '../schema/song';
import type {MediaList} from '../schema/mediaList';
import type {MediaUses} from '../schema/mediaUses';
import type {MacrosFile} from '../schema/macros';
import type {PropsFile} from '../schema/props';
import type {Slide} from '../schema/slide';
import type {SlideBackground, ThemeFile} from '../schema/theme';
import type {Themes} from '../schema/themes';
import {hasSlides, type Service} from '../schema/service';

/** The documents that can use a media item. */
export interface MediaUseSources {
  readonly media: MediaList;
  readonly props: PropsFile;
  readonly themes: Themes;
  readonly macros: MacrosFile;
  readonly songs: readonly Song[];
  readonly services: readonly Service[];
}

/** Whether a background shows a media item. */
export function showsMedia(
  background: SlideBackground | undefined,
  media: string,
): boolean {
  return background?.kind === 'media' && background.media === media;
}

function anySlide(slides: readonly Slide[], media: MediaId): boolean {
  return slides.some(slide => showsMedia(slide.background, media));
}

function themeShows(theme: ThemeFile, media: MediaId): boolean {
  return (
    showsMedia(theme.background, media) ||
    [
      ...Object.values(theme.screens),
      ...Object.values(theme.others ?? {}),
    ].some(
      screen =>
        screen.mode === 'own' &&
        screen.elements.some(
          element => element.kind === 'picture' && element.media === media,
        ),
    )
  );
}

/**
 * Counts the places that use a media item, for the delete question (spec 08,
 * "Deleting a media item that is in use").
 */
export function countMediaUses(
  mediaId: MediaId,
  sources: MediaUseSources,
): MediaUses {
  const items = sources.services.flatMap(service =>
    service.order.filter(hasSlides),
  );
  return {
    itemOverlays: items
      .flatMap(item => item.overlays ?? [])
      .filter(({content}) => 'media' in content && content.media === mediaId)
      .length,
    themes: sources.themes.themes.filter(theme => themeShows(theme, mediaId))
      .length,
    macros: sources.macros.macros.filter(macro =>
      macro.actions.some(
        action => 'media' in action && action.media === mediaId,
      ),
    ).length,
    playlists: [
      ...sources.media.playlists,
      ...sources.media.audioPlaylists,
    ].filter(playlist => playlist.items.includes(mediaId)).length,
    graphics: sources.props.props.filter(
      prop => prop.content.kind === 'image' && prop.content.media === mediaId,
    ).length,
    songBackgrounds: sources.songs.filter(song =>
      anySlide(song.slides, mediaId),
    ).length,
    serviceItems: items.filter(
      item =>
        (item.kind === 'media' && item.media === mediaId) ||
        anySlide(item.slides, mediaId),
    ).length,
  };
}
