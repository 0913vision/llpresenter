import type {ReactNode} from 'react';
import type {SlideLayer} from '@core/live/state';
import {
  isItemRow,
  type ServiceRow,
  type SlideTile,
} from '@core/presentation/model';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import {pictureSpec, type TileThemes} from '@renderer/rendering/pictureSpec';
export type {TileThemes} from '@renderer/rendering/pictureSpec';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {
  pictures,
  type PictureSpec,
} from '@renderer/rendering/pictures/pictureService';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';

/** Resolves the three possible theme sources for a service item. */
export function serviceTileThemes(
  row: ServiceRow,
  tiles: readonly SlideTile[],
  {
    themes,
    screens,
    bibleAppearance,
  }: {
    readonly themes: ThemesFile | undefined;
    readonly screens: readonly Screen[] | undefined;
    readonly bibleAppearance: TileThemes['bibleAppearance'];
  },
): TileThemes {
  const card = tiles.find(tile => tile.sectionCard !== undefined)?.sectionCard;
  const cardRow =
    card === undefined
      ? undefined
      : {
          id: row.id,
          kind: 'slides' as const,
          form: 'blank' as const,
          title: card.name,
          theme: card.theme,
        };
  const sermonRow =
    row.kind === 'bible' &&
    row.sermonTitle !== undefined &&
    row.bible !== undefined
      ? sermonPreviewRow(row.id, row.bible.ref)
      : undefined;
  const settings = {source: 'service' as const, file: themes, screens};
  return {
    theme: slideTheme(isItemRow(row) ? row : undefined, settings),
    cardTheme: slideTheme(cardRow, settings),
    sermonTheme: slideTheme(sermonRow, settings),
    bibleAppearance,
  };
}

/** Resolves the same source for the grid and service-wide preloading. */
export function tilePictureSpec(
  tile: SlideTile,
  slide: SlideLayer | null,
  themes: TileThemes,
): PictureSpec | undefined {
  return tilePictureResult(tile, slide, themes)?.spec;
}

function tilePictureResult(
  tile: SlideTile,
  slide: SlideLayer | null,
  themes: TileThemes,
) {
  return pictureSpec({kind: 'tile', slide, tile, themes});
}

export function tilePicture(
  tile: SlideTile,
  slide: SlideLayer | null,
  themes: TileThemes,
): ReactNode {
  const picture = tilePictureResult(tile, slide, themes);
  if (
    picture === undefined ||
    (picture.kind === 'media' && pictures.drawInPlace)
  ) {
    return undefined;
  }
  const {spec} = picture;
  return (
    <Picture
      {...spec}
      resample={spec.appearance.screen.method !== 'ndi'}
      wait={themes.switchSlot !== undefined}
      switchSlot={themes.switchSlot}
    />
  );
}
