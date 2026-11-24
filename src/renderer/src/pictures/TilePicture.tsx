import {type JSX} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {useThemes} from '@renderer/platform/themes';
import {tileDrawing, type TileDrawingOptions} from './slideDrawing';
import {SlidePicture} from './SlidePicture';

/** A slide of a list, drawn in the theme that slide has. */
export function TilePicture({
  tile,
  ...options
}: TileDrawingOptions & {readonly tile: ShowTile}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const screens = useThemes(view => view.screens);
  return <SlidePicture {...tileDrawing(tile, {themes, screens}, options)} />;
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
