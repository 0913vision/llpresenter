import type {ThemeElementId} from '../schema/ids';
import {checkPart} from '../schema/fileFormat';
import {
  themeClipboardSchema,
  themeElementSchema,
  type ThemeElement,
  type ThemesFile,
} from '../schema/themes';
import {canRepeatThemeElement} from './elementRules';
import {
  editThemeLayout,
  type ThemeEditResult,
  type ThemeTarget,
} from './themeEdits';

export type TextThemeElement = Extract<ThemeElement, {readonly text: object}>;
export function hasThemeText(
  element: ThemeElement,
): element is TextThemeElement {
  return !['media', 'background', 'overlay', 'image', 'box'].includes(
    element.kind,
  );
}

/** Keeps property transforms serialized and checked, including nested style updates. */
export function editThemeElements(
  file: ThemesFile,
  target: ThemeTarget,
  change: (
    elements: readonly ThemeElement[],
  ) => readonly ThemeElement[] | undefined,
): ThemeEditResult {
  return editThemeLayout(file, target, layout => {
    if (layout.mode.kind !== 'own') return undefined;
    const elements = change(layout.elements);
    return elements === undefined ? undefined : {...layout, elements};
  });
}

export function changeThemeElement(
  elements: readonly ThemeElement[],
  id: string,
  change: (element: ThemeElement) => unknown,
): readonly ThemeElement[] | undefined {
  const index = elements.findIndex(element => element.id === id);
  const element = elements[index];
  if (element === undefined) return undefined;
  const parsed = checkPart(themeElementSchema, change(element));
  const changed = parsed.ok ? parsed.value : undefined;
  if (changed?.id !== element.id || changed.kind !== element.kind) {
    return undefined;
  }
  return elements.map(value => (value.id === id ? changed : value));
}

export function moveThemeElement(
  elements: readonly ThemeElement[],
  id: string,
  index: number,
): readonly ThemeElement[] {
  const element = elements.find(value => value.id === id);
  if (element === undefined) return elements;
  const rest = elements.filter(value => value.id !== id);
  const position = Math.max(0, Math.min(rest.length, Math.round(index)));
  return [...rest.slice(0, position), element, ...rest.slice(position)];
}

export function dropThemeElement(
  elements: readonly ThemeElement[],
  id: string,
  boundary: number,
): readonly ThemeElement[] {
  const source = elements.findIndex(element => element.id === id);
  return source < 0
    ? elements
    : moveThemeElement(elements, id, boundary - (source < boundary ? 1 : 0));
}

/** Replaces one-per-screen kinds in place; repeatable elements get fresh identities. */
export function pasteThemeElements(
  elements: readonly ThemeElement[],
  pasted: readonly ThemeElement[],
  ids: readonly ThemeElementId[],
): readonly ThemeElement[] | undefined {
  if (ids.length !== pasted.length) return undefined;
  const next = [...elements];
  for (const [position, source] of pasted.entries()) {
    const id = ids[position];
    if (id === undefined) return undefined;
    const index = canRepeatThemeElement(source.kind)
      ? -1
      : next.findIndex(element => element.kind === source.kind);
    const existing = next[index];
    if (existing === undefined) next.push({...source, id});
    else next[index] = {...existing, ...source, id: existing.id};
  }
  return next;
}

export function serializeThemeClipboard(
  elements: readonly ThemeElement[],
): string {
  return JSON.stringify({format: 'llp.theme-elements', version: 1, elements});
}

const CLIPBOARD_LIMIT = 1_000_000;
export function parseThemeClipboard(
  text: string,
): readonly ThemeElement[] | undefined {
  if (text.length > CLIPBOARD_LIMIT) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    const parsed = checkPart(themeClipboardSchema, value);
    return parsed.ok ? parsed.value.elements : undefined;
  } catch {
    return undefined;
  }
}
