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
function place(drawing: ThemeDrawing): PlacedTexts {
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

/** Whether the label in front made a text smaller or gave it more rows. */
function labelCosts(inFront: PlacedTexts, without: PlacedTexts): boolean {
  return [...inFront.texts.values()].some(({element}) => {
    if (element.kind !== 'text' || element.label !== true) return false;
    const there = inFront.placement.texts.get(element.id);
    const plain = without.placement.texts.get(element.id);
    return (
      there !== undefined &&
      plain !== undefined &&
      (there.size < plain.size || there.h > plain.h + 1)
    );
  });
}

/**
 * Places the texts of a screen. A label in front of the first row goes on a
 * row of its own above when in front it would make the text smaller or give
 * it more rows than it has without the label.
 */
export function placeTexts(drawing: ThemeDrawing): PlacedTexts {
  const placed = place(drawing);
  if (drawing.labels !== 'inline') return placed;
  const without = place({...drawing, labels: 'off'});
  return labelCosts(placed, without)
    ? place({...drawing, labels: 'line'})
    : placed;
}
