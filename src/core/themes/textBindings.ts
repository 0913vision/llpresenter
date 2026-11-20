import type {ScreenId, ThemeId} from '../schema/ids';
import type {Theme, ThemeElement, ThemeScreenLayout} from '../schema/themes';
import {themeTextRoleNames, type ThemeTextRole} from '../schema/themeTextSlot';
import {manualSlideTextKey} from '../schema/slideTextOverrides';
import {isBuiltInThemeId} from './builtInIds';
import {isThemeTextElement} from './content';

type TextElement = Extract<ThemeElement, {readonly text: unknown}>;

export interface TextSlotLayout {
  readonly themeId: ThemeId;
  readonly sourceScreenId: ScreenId;
  readonly layout: ThemeScreenLayout;
}

const ambiguousShared = new WeakMap<Theme, readonly ThemeTextRole[]>();

function identifiesSharedSlot(
  theme: Pick<TextSlotLayout, 'themeId' | 'layout'>,
  element: TextElement,
): boolean {
  if (element.textSlot !== undefined) {
    return element.textSlot.scope === 'shared';
  }
  return (
    isBuiltInThemeId(theme.themeId) &&
    element.kind !== 'text' &&
    theme.layout.elements.filter(candidate => candidate.kind === element.kind)
      .length === 1
  );
}

function sharedRoleConflicts(theme: Theme): readonly ThemeTextRole[] {
  const slots = new Map<ThemeTextRole, Set<string>>();
  for (const layout of Object.values(theme.screens)) {
    if (layout.mode.kind !== 'own') continue;
    for (const element of layout.elements.filter(isThemeTextElement)) {
      if (!identifiesSharedSlot({themeId: theme.id, layout}, element)) continue;
      const role = element.textSlot?.role ?? element.kind;
      const ids = slots.get(role) ?? new Set<string>();
      ids.add(element.textSlot?.slotId ?? element.kind);
      slots.set(role, ids);
    }
  }
  return [...slots].filter(([, ids]) => ids.size > 1).map(([role]) => role);
}

export function legacyTextBinding(
  theme: TextSlotLayout,
  element: TextElement,
): string {
  return isBuiltInThemeId(theme.themeId) &&
    element.kind !== 'text' &&
    theme.layout.elements.filter(candidate => candidate.kind === element.kind)
      .length === 1
    ? element.kind
    : `${theme.themeId}/${theme.sourceScreenId}/${element.id}`;
}

function bindingIdentity(theme: TextSlotLayout, element: TextElement) {
  const shared = identifiesSharedSlot(theme, element);
  const slotId =
    element.textSlot?.slotId ?? (shared ? element.kind : element.id);
  const screenId = shared ? undefined : theme.sourceScreenId;
  return {
    slotId,
    screenId,
    role: element.textSlot?.role ?? element.kind,
    key: manualSlideTextKey({sourceThemeId: theme.themeId, screenId, slotId}),
  };
}

/** Migrates legacy elements without changing their default fills or appearance. */
export function withDefaultTextSlots(theme: Theme): Theme {
  return {
    ...theme,
    screens: Object.fromEntries(
      Object.entries(theme.screens).map(([screenId, layout]) => {
        const ids = new Set(
          layout.elements.flatMap(element =>
            isThemeTextElement(element) && element.textSlot !== undefined
              ? [element.textSlot.slotId]
              : [],
          ),
        );
        return [
          screenId,
          {
            ...layout,
            elements: layout.elements.map(element => {
              if (
                !isThemeTextElement(element) ||
                element.textSlot !== undefined
              ) {
                return element;
              }
              const shared =
                isBuiltInThemeId(theme.id) &&
                element.kind !== 'text' &&
                !ids.has(element.kind) &&
                layout.elements.filter(
                  candidate => candidate.kind === element.kind,
                ).length === 1;
              let slotId: string = shared ? element.kind : element.id;
              while (ids.has(slotId)) slotId += '-';
              ids.add(slotId);
              const name =
                'name' in element &&
                typeof element.name === 'string' &&
                element.name.trim()
                  ? element.name.slice(0, 160)
                  : themeTextRoleNames[element.kind];
              return {
                ...element,
                textSlot: {
                  slotId,
                  role: element.kind,
                  name,
                  scope: shared ? 'shared' : 'screen',
                },
              };
            }),
          },
        ];
      }),
    ),
  };
}

/** Gives each textbox an identity that is independent of its text and position. */
export function themeTextBinding(theme: TextSlotLayout, element: TextElement) {
  const identity = bindingIdentity(theme, element);
  const localRoles = theme.layout.elements.filter(
    candidate =>
      isThemeTextElement(candidate) &&
      (candidate.textSlot?.role ?? candidate.kind) === identity.role,
  );
  return {
    ...identity,
    name: element.textSlot?.name,
    uniqueRole:
      localRoles.length === 1 &&
      !theme.layout.ambiguousTextRoles?.includes(identity.role),
  };
}

/** Counts distinct shared identities across all own layouts in a theme. */
export function withTextRoleResolution(
  theme: Theme,
  layout: ThemeScreenLayout,
): ThemeScreenLayout {
  let sharedAmbiguities = ambiguousShared.get(theme);
  if (sharedAmbiguities === undefined) {
    sharedAmbiguities = sharedRoleConflicts(theme);
    ambiguousShared.set(theme, sharedAmbiguities);
  }
  const local = new Map<ThemeTextRole, number>();
  for (const element of layout.elements) {
    if (!isThemeTextElement(element)) continue;
    const role = element.textSlot?.role ?? element.kind;
    local.set(role, (local.get(role) ?? 0) + 1);
  }
  const ambiguous = [
    ...new Set([
      ...sharedAmbiguities,
      ...[...local].filter(([, count]) => count > 1).map(([role]) => role),
    ]),
  ];
  if (ambiguous.length > 0) return {...layout, ambiguousTextRoles: ambiguous};
  if (layout.ambiguousTextRoles === undefined) return layout;
  const {ambiguousTextRoles: _old, ...resolved} = layout;
  return resolved;
}
