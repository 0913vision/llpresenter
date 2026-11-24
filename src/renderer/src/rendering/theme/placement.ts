import {layoutTheme, type ThemePlacement} from '@core/theme';
import {measuredText} from './measureRows';
import {
  peerRows,
  shownTexts,
  type ShownText,
  type ThemeDrawing,
} from './shownTexts';

/** The texts of a screen with their places. */
export interface PlacedTexts {
  readonly texts: ReadonlyMap<string, ShownText>;
  readonly placement: ThemePlacement;
}

/** Places the texts of a screen at the sizes and places its theme gives. */
export function placeTexts(drawing: ThemeDrawing): PlacedTexts {
  const texts = shownTexts(drawing);
  const placement = layoutTheme(
    drawing.screen,
    new Map(
      [...texts].map(([id, entry]) => [
        id,
        measuredText(entry.rows, peerRows(drawing, entry)),
      ]),
    ),
  );
  return {texts, placement};
}
