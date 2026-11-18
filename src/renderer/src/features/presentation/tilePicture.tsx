import type {ReactNode} from 'react';
import type {SlideLayer} from '@core/live/state';
import {
  isItemRow,
  type ServiceRow,
  type SlideTile,
} from '@core/presentation/model';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import {outputSlideSpec} from '@renderer/rendering/OutputSlidePicture';
import {Picture} from '@renderer/rendering/pictures/Picture';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import type {useBibleTileProjection} from '../bible/useBibleProjections';

type SlideTheme = ReturnType<typeof slideTheme>;
type BibleAppearance = NonNullable<
  ReturnType<typeof useBibleTileProjection>
>['appearance'];

/** The themes a presentation tile can draw with. */
export interface TileThemes {
  readonly theme: SlideTheme;
  readonly cardTheme: SlideTheme;
  readonly sermonTheme: SlideTheme;
  readonly bibleAppearance: BibleAppearance | undefined;
  readonly switchSlot?: string | undefined;
}

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
    readonly bibleAppearance: BibleAppearance | undefined;
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
  if (tile.media?.mediaId !== undefined || slide === null) return undefined;
  const content = {slide, songSource: tile.sourceSlide};
  if (tile.sectionCard !== undefined && cardTheme !== undefined) {
    return outputSlideSpec({...cardTheme, ...content});
  }
  if (tile.sermonTitle === true && sermonTheme !== undefined) {
    return outputSlideSpec({...sermonTheme, ...content});
  }
  const appearance = tile.biblePart === undefined ? undefined : bibleAppearance;
  if (appearance !== undefined) {
    return outputSlideSpec({
      screen: appearance.screen,
      sourceScreenId: appearance.theme.sourceScreenId,
      themeId: appearance.theme.themeId,
      ...content,
      layout: appearance.theme.layout,
      emptyColor: appearance.theme.emptyColor,
      item: appearance.theme.item,
      background: appearance.background,
    });
  }
  return theme === undefined
    ? undefined
    : outputSlideSpec({...theme, ...content});
}

export function tilePicture(
  tile: SlideTile,
  slide: SlideLayer | null,
  themes: TileThemes,
): ReactNode {
  const spec = tilePictureSpec(tile, slide, themes);
  return spec === undefined ? undefined : (
    <Picture
      {...spec}
      wait={themes.switchSlot !== undefined}
      switchSlot={themes.switchSlot}
    />
  );
}
