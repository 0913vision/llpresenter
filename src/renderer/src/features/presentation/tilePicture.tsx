import type {ReactNode} from 'react';
import type {SlideLayer} from '@core/live/state';
import type {SlideTile} from '@core/presentation/model';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import type {useSlideTheme} from '@renderer/platform/useSlideTheme';
import type {useBibleTileProjection} from '../bible/useBibleProjections';

type SlideTheme = ReturnType<typeof useSlideTheme>;
type BibleAppearance = NonNullable<
  ReturnType<typeof useBibleTileProjection>
>['appearance'];

/** The themes a 진행 tile can draw with. */
export interface TileThemes {
  readonly theme: SlideTheme;
  readonly cardTheme: SlideTheme;
  readonly sermonTheme: SlideTheme;
  readonly bibleAppearance: BibleAppearance | undefined;
}

/**
 * The drawn picture of a 진행 tile, or nothing for a media tile, which shows
 * its thumbnail. The grid and the drawing ahead of the next items share it, so
 * both draw the same picture for the same tile.
 */
export function tilePicture(
  tile: SlideTile,
  slide: SlideLayer | null,
  {theme, cardTheme, sermonTheme, bibleAppearance}: TileThemes,
): ReactNode {
  if (tile.media?.mediaId !== undefined || slide === null) return undefined;
  if (tile.sectionCard !== undefined && cardTheme !== undefined) {
    return <SlidePicture output {...cardTheme} slide={slide} />;
  }
  if (tile.sermonTitle === true && sermonTheme !== undefined) {
    return <SlidePicture output {...sermonTheme} slide={slide} />;
  }
  const appearance = tile.biblePart === undefined ? undefined : bibleAppearance;
  if (appearance !== undefined) {
    return (
      <SlidePicture
        output
        screen={appearance.screen}
        themeId={appearance.theme.themeId}
        slide={slide}
        layout={appearance.theme.layout}
        emptyColor={appearance.theme.emptyColor}
        item={appearance.theme.item}
        background={appearance.background}
      />
    );
  }
  return theme === undefined ? undefined : (
    <SlidePicture output {...theme} slide={slide} />
  );
}
