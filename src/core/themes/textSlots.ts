import type {ScreenId, ThemeId} from '../schema/ids';
import type {ThemeElement, ThemeScreenLayout} from '../schema/themes';
import type {SlideLayer} from '../live/state';
import {createDefaultThemes} from './defaults';
import {isThemeTextElement} from './content';
import {CONT_MARKER} from '../bible/split/layout';

const builtIn = new Set(createDefaultThemes().themes.map(theme => theme.id));

export interface TextSlotLayout {
  readonly themeId: ThemeId;
  readonly sourceScreenId: ScreenId;
  readonly layout: ThemeScreenLayout;
}

export function manualThemeText(
  element: ThemeElement | undefined,
): string | undefined {
  return element &&
    'manualText' in element &&
    typeof element.manualText === 'string'
    ? element.manualText
    : undefined;
}

/** Preset roles share values across screens; each custom box has its own identity. */
export function themeTextSlot(
  theme: TextSlotLayout,
  element: ThemeElement,
): string {
  return builtIn.has(theme.themeId) &&
    element.kind !== 'text' &&
    theme.layout.elements.filter(candidate => candidate.kind === element.kind)
      .length === 1
    ? element.kind
    : `${theme.themeId}/${theme.sourceScreenId}/${element.id}`;
}

export function withSlideTextOverrides(
  theme: TextSlotLayout,
  slide: SlideLayer | null,
): ThemeScreenLayout {
  const {layout} = theme;
  const current = slide?.textOverrides;
  const next = slide?.next?.textOverrides;
  if (current === undefined && next === undefined) return layout;
  const body = layout.elements.find(element => element.kind === 'currentText');
  const label = layout.elements.find(element => element.kind === 'label');
  const nextBody =
    next?.[body === undefined ? 'currentText' : themeTextSlot(theme, body)];
  const nextLabel =
    next?.[label === undefined ? 'label' : themeTextSlot(theme, label)];
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (!isThemeTextElement(element)) return element;
      const text =
        current?.[themeTextSlot(theme, element)] ??
        (element.kind === 'nextText' ? nextBody : undefined) ??
        (element.kind === 'nextLabel' ? nextLabel : undefined);
      if (text === undefined) return element;
      const continued =
        (element.kind === 'currentText' && slide?.continued === true) ||
        (element.kind === 'nextText' && slide?.next?.continued === true);
      return {
        ...element,
        manualText:
          continued && !text.trimEnd().endsWith(CONT_MARKER.trim())
            ? text.trimEnd() + CONT_MARKER
            : text,
      };
    }),
  };
}
