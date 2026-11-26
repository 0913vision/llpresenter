import {type JSX} from 'react';
import type {ShowTile} from '@core/schema/services/showService';
import type {Slide} from '@core/schema/slides/slide';
import {unavailableMedia, useMedia} from '@renderer/platform/documents/media';
import {useThemes} from '@renderer/platform/documents/themes';
import {tileDrawing, type TileDrawingOptions} from './slideDrawing';
import {SlidePicture} from './SlidePicture';

function withoutBackground(tile: ShowTile): ShowTile {
  const {background: _missing, ...slide} = tile.slide;
  return {...tile, slide};
}

/** A slide of a list, drawn in the theme that slide has. */
export function TilePicture({
  tile,
  ...options
}: TileDrawingOptions & {readonly tile: ShowTile}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const screens = useThemes(view => view.screens);
  const missingFileOf = useMissingFileOf();
  // NOTE(0913vision): A slide whose background file is missing goes out on
  // its theme's background (USER Nov 26), so its picture shows that too.
  const shown =
    missingFileOf(tile.slide) === undefined ? tile : withoutBackground(tile);
  return <SlidePicture {...tileDrawing(shown, {themes, screens}, options)} />;
}

/**
 * Tells the file of a slide's own background when it can't be found, for the
 * mark its thumbnail shows in place (spec 08, "Missing media file").
 */
export function useMissingFileOf(): (
  slide: Pick<Slide, 'background'>,
) => string | undefined {
  const document = useMedia(view => view.document);
  const missing = useMedia(view => view.missing);
  const items = useMedia(view => view.items);
  return ({background}) =>
    background?.kind === 'media' &&
    unavailableMedia({document, items, missing}, background.media)
      ? (items.find(item => item.id === background.media)?.file ??
        background.media)
      : undefined;
}

/** What a thumbnail says beside the picture of its slide. */
export function tileProps(tile: ShowTile) {
  const text = Object.values(tile.slide.texts).join('\n');
  return {
    label: tile.caption ?? undefined,
    labelColor: tile.labelColor,
    accessibleLabel: tile.caption === null ? text : undefined,
    text,
    hotKey: tile.slide.hotKey,
  };
}
