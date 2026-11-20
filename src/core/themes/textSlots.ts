import type {ScreenId, ThemeId} from '../schema/ids';
import type {ThemeElement, ThemeScreenLayout} from '../schema/themes';
import type {SlideLayer} from '../live/state';
import {createDefaultThemes} from './defaults';
import {isThemeTextElement} from './content';

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
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (!isThemeTextElement(element)) return element;
      const text =
        current?.[themeTextSlot(theme, element)] ??
        (element.kind === 'nextText' ? next?.['currentText'] : undefined) ??
        (element.kind === 'nextLabel' ? next?.['label'] : undefined);
      return text === undefined ? element : {...element, manualText: text};
    }),
  };
}
