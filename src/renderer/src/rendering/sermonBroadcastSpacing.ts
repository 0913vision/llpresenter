import type {ThemeElement} from '@core/schema/themes';
import {
  SERMON_TITLE_THEME_ID,
  sermonTitleBroadcastLayout,
} from '@core/themes/sundayScripture';
import {SERMON_TITLE_BAND_ID} from '@core/themes/sectionBroadcast';
import type {RenderFrame} from './layer';

interface SpacingView {
  readonly element: ThemeElement;
  textBounds(ink?: boolean): {top: number; bottom: number} | undefined;
  setY(y: number): void;
  setHeight(height: number): void;
}

function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, child: unknown) =>
    child !== null && typeof child === 'object' && !Array.isArray(child)
      ? Object.fromEntries(
          Object.entries(child).sort(([a], [b]) => a.localeCompare(b)),
        )
      : child,
  );
}

const builtIn = canonical(sermonTitleBroadcastLayout());
const INK_GAP = 20;
const BAND_PADDING = 40;

/** Positions the unedited broadcast title band around its rendered ink. */
export function positionSermonBroadcast(
  views: readonly SpacingView[],
  frame: RenderFrame | undefined,
): void {
  const theme = frame?.theme;
  if (
    frame?.screen?.kind !== 'broadcast' ||
    theme?.themeId !== SERMON_TITLE_THEME_ID ||
    canonical(theme.layout) !== builtIn
  ) {
    return;
  }
  const band = views.find(view => view.element.id === SERMON_TITLE_BAND_ID);
  const reference = views.find(view => view.element.kind === 'itemName');
  const title = views.find(view => view.element.kind === 'currentText');
  if (!band || !reference || !title) return;
  reference.setY(reference.element.frame.y);
  title.setY(title.element.frame.y);
  const referenceInk = reference.textBounds(true);
  const titleInk = title.textBounds(true);
  if (!referenceInk || !titleInk) return;
  const bottom = band.element.frame.y + band.element.frame.h;
  const titleShift = bottom - BAND_PADDING - titleInk.bottom;
  const referenceShift =
    titleInk.top + titleShift - INK_GAP - referenceInk.bottom;
  const top = Math.max(0, referenceInk.top + referenceShift - BAND_PADDING);
  title.setY(title.element.frame.y + titleShift);
  reference.setY(reference.element.frame.y + referenceShift);
  band.setY(top);
  band.setHeight(bottom - top);
}
