import {
  followedText,
  isLabelText,
  layoutTheme,
  type SameText,
  type ThemePlacement,
} from '@core/theme';
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

function layout(
  drawing: ThemeDrawing,
  texts: ReadonlyMap<string, ShownText>,
  same?: ReadonlyMap<string, SameText>,
): ThemePlacement {
  return layoutTheme(
    drawing.screen,
    new Map(
      [...texts].map(([id, entry]) => [
        id,
        measuredText(entry.rows, peerRows(drawing, entry)),
      ]),
    ),
    same,
  );
}

interface Followed extends PlacedTexts {
  /** The sizes 청중 gives the texts that follow it. */
  readonly same: ReadonlyMap<string, SameText>;
}

/** Places the texts of a screen; those of 무대 may follow 청중. */
function placeFollowing(drawing: ThemeDrawing): Followed {
  const shown = shownTexts(drawing);
  const {audience} = drawing;
  const follows = [...shown.values()].some(
    ({element}) => element.kind === 'text' && element.same !== undefined,
  );
  if (audience === undefined || !follows) {
    return {texts: shown, placement: layout(drawing, shown), same: new Map()};
  }
  const texts = new Map(shown);
  const same = new Map<string, SameText>();
  const onAudience: ThemeDrawing = {...drawing, screen: audience};
  const there = shownTexts(onAudience);
  const places = layout(onAudience, there).texts;
  for (const [id, entry] of shown) {
    if (entry.element.kind !== 'text' || entry.element.same === undefined) {
      continue;
    }
    const followed = followedText(
      entry.element,
      drawing.screen.elements,
      audience.elements,
    );
    const twin = followed === undefined ? undefined : there.get(followed.id);
    const placed = twin === undefined ? undefined : places.get(twin.element.id);
    if (twin === undefined || placed === undefined) continue;
    same.set(id, {size: placed.size});
    if (entry.element.same === 'rows' && !isLabelText(entry.element)) {
      const rows = measuredText(twin.rows).wrapped(placed.size);
      texts.set(id, {
        ...entry,
        rows: {...entry.rows, text: rows.join('\n')},
      });
    }
  }
  return {texts, placement: layout(drawing, texts, same), same};
}

/** Whether a text that carries the label came out smaller than on 청중. */
function labelShrinks({texts, placement, same}: Followed): boolean {
  return [...texts.values()].some(({element}) => {
    if (element.kind !== 'text' || element.label !== true) return false;
    const target = same.get(element.id)?.size;
    const size = placement.texts.get(element.id)?.size;
    return target !== undefined && size !== undefined && size < target;
  });
}

/**
 * Places the texts of a screen; those of 무대 may follow 청중. A label in
 * front of the first row goes on a row of its own above when it would make
 * the row smaller than on 청중.
 */
export function placeTexts(drawing: ThemeDrawing): PlacedTexts {
  const placed = placeFollowing(drawing);
  if (drawing.labels !== 'inline' || !labelShrinks(placed)) return placed;
  return placeFollowing({...drawing, labels: 'line'});
}
