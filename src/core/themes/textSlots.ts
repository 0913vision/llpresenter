import {parsePayload} from '../schema/payload';
import {themeElementIdSchema} from '../schema/ids';
import type {ThemeElement, ThemeScreenLayout} from '../schema/themes';
import type {SlideLayer} from '../live/state';
import {
  isSlideEditableElement,
  isSlideEditableTextRole,
  isThemeTextElement,
} from './content';
import {themeTextRoles} from '../schema/themeTextSlot';
import type {ThemeItemKind} from './elementRules';
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

const knownTextRoles: ReadonlySet<string> = new Set(themeTextRoles);

export function isSlideEditableTextValue(
  key: string,
  value: SlideTextValue,
  itemKind?: ThemeItemKind,
): boolean {
  return typeof value === 'string'
    ? !knownTextRoles.has(key) || isSlideEditableTextRole(key, itemKind)
    : isSlideEditableTextRole(value.role, itemKind);
}

/** Resolves exact bindings before portable, unambiguous roles. */
export function matchSlideText(
  values: SlideTextOverrides | undefined,
  theme: TextSlotLayout,
  element: Extract<ThemeElement, {readonly text: unknown}>,
): {readonly key: string; readonly value: SlideTextValue} | undefined {
  const {itemKind} = theme;
  if (values === undefined || !isSlideEditableElement(element, itemKind)) {
    return undefined;
  }
  const binding = themeTextBinding(theme, element);
  const exact = values[binding.key];
  if (
    exact !== undefined &&
    isSlideEditableTextValue(binding.key, exact, itemKind)
  ) {
    return {key: binding.key, value: exact};
  }
  const oldKey = legacyTextBinding(theme, element);
  const old = values[oldKey];
  if (
    typeof old === 'string' &&
    isSlideEditableTextValue(oldKey, old, itemKind)
  ) {
    return {key: oldKey, value: old};
  }
  const candidates = Object.entries(values).flatMap(([key, value]) =>
    typeof value !== 'string' &&
    isSlideEditableTextValue(key, value, itemKind) &&
    value.sourceThemeId !== theme.themeId &&
    value.screenId === binding.screenId
      ? [{key, value}]
      : [],
  );
  const explicit = binding.explicitSlot
    ? candidates.filter(
        ({value}) =>
          value.slotId === binding.slotId &&
          (value.explicitSlot === true ||
            value.screenId === undefined ||
            !parsePayload(themeElementIdSchema, value.slotId).ok),
      )
    : [];
  if (explicit.length > 0) {
    return explicit.length === 1 ? explicit[0] : undefined;
  }
  if (!binding.uniqueRole) return undefined;
  const role = candidates.filter(
    ({value}) => value.uniqueRole === true && value.role === binding.role,
  );
  return role.length === 1 ? role[0] : undefined;
}

function legacyNextText(
  values: SlideTextOverrides | undefined,
  role: 'currentText' | 'label',
): string | undefined {
  const value = values?.[role];
  return typeof value === 'string' ? value : undefined;
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
      .filter(
        element =>
          isSlideEditableElement(element) &&
          (element.textSlot?.role ?? element.kind) === role,
      );
    const [element] = candidates;
    return slideTextValue(
      candidates.length === 0
        ? legacyNextText(next, role)
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
      const role = element.textSlot?.role ?? element.kind;
      const text = isSlideEditableElement(element)
        ? slideTextValue(matchSlideText(current, theme, element)?.value)
        : element.kind === 'nextText' && role === 'nextText'
          ? nextBody
          : element.kind === 'nextLabel' && role === 'nextLabel'
            ? nextLabel
            : undefined;
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
