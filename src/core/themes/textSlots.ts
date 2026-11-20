import type {ThemeElement, ThemeScreenLayout} from '../schema/themes';
import type {SlideLayer} from '../live/state';
import {isThemeTextElement} from './content';
import {CONT_MARKER} from '../bible/split/layout';
import {slideTextValue} from '../presentation/textOverrides';
import type {
  SlideTextOverrides,
  SlideTextValue,
} from '../schema/slideTextOverrides';
import {
  legacyTextBinding,
  themeTextBinding,
  type TextSlotLayout,
} from './textBindings';

export function manualThemeText(
  element: ThemeElement | undefined,
): string | undefined {
  return element &&
    'manualText' in element &&
    typeof element.manualText === 'string'
    ? element.manualText
    : undefined;
}

/** Resolves exact bindings before portable, unambiguous roles. */
export function matchSlideText(
  values: SlideTextOverrides | undefined,
  theme: TextSlotLayout,
  element: Extract<ThemeElement, {readonly text: unknown}>,
): {readonly key: string; readonly value: SlideTextValue} | undefined {
  if (values === undefined) return undefined;
  const binding = themeTextBinding(theme, element);
  const exact = values[binding.key];
  if (exact !== undefined) return {key: binding.key, value: exact};
  const oldKey = legacyTextBinding(theme, element);
  const old = values[oldKey];
  if (typeof old === 'string') return {key: oldKey, value: old};
  const candidates = Object.entries(values).flatMap(([key, value]) =>
    typeof value !== 'string' &&
    value.sourceThemeId !== theme.themeId &&
    value.screenId === binding.screenId
      ? [{key, value}]
      : [],
  );
  const explicit = candidates.filter(
    ({value}) => value.slotId === binding.slotId,
  );
  if (explicit.length > 0) {
    return explicit.length === 1 ? explicit[0] : undefined;
  }
  if (!binding.uniqueRole) return undefined;
  const role = candidates.filter(
    ({value}) => value.uniqueRole === true && value.role === binding.role,
  );
  return role.length === 1 ? role[0] : undefined;
}

export function withSlideTextOverrides(
  theme: TextSlotLayout,
  slide: SlideLayer | null,
): ThemeScreenLayout {
  const {layout} = theme;
  const current = slide?.textOverrides;
  const next = slide?.next?.textOverrides;
  if (current === undefined && next === undefined) return layout;
  const nextText = (role: 'currentText' | 'label'): string | undefined => {
    const candidates = layout.elements
      .filter(isThemeTextElement)
      .filter(element => (element.textSlot?.role ?? element.kind) === role);
    const [element] = candidates;
    return slideTextValue(
      candidates.length === 0
        ? next?.[role]
        : element && candidates.length === 1
          ? matchSlideText(next, theme, element)?.value
          : undefined,
    );
  };
  const nextBody = nextText('currentText');
  const nextLabel = nextText('label');
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (!isThemeTextElement(element)) return element;
      const text =
        slideTextValue(matchSlideText(current, theme, element)?.value) ??
        (element.kind === 'nextText' ? nextBody : undefined) ??
        (element.kind === 'nextLabel' ? nextLabel : undefined);
      if (text === undefined) return element;
      const continued =
        (element.kind === 'currentText' && slide?.continued === true) ||
        (element.kind === 'nextText' && slide?.next?.continued === true);
      return {
        ...element,
        manualText:
          continued &&
          text.trim() !== '' &&
          !text.trimEnd().endsWith(CONT_MARKER.trim())
            ? text.trimEnd() + CONT_MARKER
            : text,
      };
    }),
  };
}
