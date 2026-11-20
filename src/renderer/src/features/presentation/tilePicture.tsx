import {Suspense, type ReactNode} from 'react';
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
import {ComposedPicture} from '@renderer/rendering/pictures/ComposedPicture';
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
  {theme, cardTheme, sermonTheme, bibleAppearance}: TileThemes,
): PictureSpec | undefined {
  return pictureSpec({
    kind: 'tile',
    slide,
    tile,
    themes: {theme, cardTheme, sermonTheme, bibleAppearance},
  })?.spec;
}

export function tilePicture(
  tile: SlideTile,
  slide: SlideLayer | null,
  themes: TileThemes & {readonly drawInPlace?: boolean},
): ReactNode {
  const spec = tilePictureSpec(tile, slide, themes);
  if (tile.media !== undefined && pictures.drawInPlace) return undefined;
  if (spec === undefined) return undefined;
  const picture = (
    <Picture
      {...spec}
      resample={spec.appearance.screen.method !== 'ndi'}
      wait={themes.switchSlot !== undefined}
      switchSlot={themes.switchSlot}
      keepDecoded={themes.drawInPlace}
    />
  );
  return themes.drawInPlace ? (
    <Suspense fallback={<ComposedPicture spec={spec} />}>{picture}</Suspense>
  ) : (
    picture
  );
}
