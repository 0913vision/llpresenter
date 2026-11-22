import type {JSX} from 'react';
import type {SlideLayer} from '@core/live/state';
import type {SlideTile} from '@core/presentation/model';
import {tileInput, type ItemThemes} from './itemThemes';
import {SlidePicture} from './SlidePicture';

/** A slide of an item, drawn in the theme that slide has. */
export function TilePicture({
  tile,
  slide,
  themes,
}: {
  readonly tile: SlideTile;
  readonly slide: SlideLayer | null;
  readonly themes: ItemThemes;
}): JSX.Element | null {
  const input = tileInput(tile, slide, themes);
  return input === undefined ? null : <SlidePicture {...input} />;
}
