import {
  layoutTheme,
  type SameText,
  type ThemePlacement,
  templateTokens,
} from '@core/theme';
import {measuredText} from './measureRows';
import {
  isLabel,
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

function shareToken(a: readonly string[], b: readonly string[]): boolean {
  const other = templateTokens(b);
  return [...templateTokens(a)].some(token => other.has(token));
}

/** The text of 청중 that a text of 무대 takes its size from. */
function twinOf(
  shown: ShownText,
  there: ReadonlyMap<string, ShownText>,
): ShownText | undefined {
  const {element} = shown;
  if (element.kind !== 'text') return undefined;
  const label = isLabel(element);
  return [...there.values()].find(
    ({element: other}) =>
      other.kind === 'text' &&
      (label ? !isLabel(other) : shareToken(other.content, element.content)),
  );
}

/** Places the texts of a screen; those of 무대 may follow 청중. */
export function placeTexts(drawing: ThemeDrawing): PlacedTexts {
  const shown = shownTexts(drawing);
  const {audience} = drawing;
  const follows = [...shown.values()].some(
    ({element}) => element.kind === 'text' && element.same !== undefined,
  );
  if (audience === undefined || !follows) {
    return {texts: shown, placement: layout(drawing, shown)};
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
    const twin = twinOf(entry, there);
    const placed = twin === undefined ? undefined : places.get(twin.element.id);
    if (twin === undefined || placed === undefined) continue;
    same.set(id, {size: placed.size});
    if (entry.element.same === 'rows' && !isLabel(entry.element)) {
      const rows = measuredText(twin.rows).wrapped(placed.size);
      texts.set(id, {
        ...entry,
        rows: {...entry.rows, text: rows.join('\n')},
      });
    }
  }
  return {texts, placement: layout(drawing, texts, same)};
}
