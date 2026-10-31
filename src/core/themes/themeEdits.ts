import type {Result} from '../common/result';
import {checkPart} from '../schema/fileFormat';
import type {ScreenId, ThemeId} from '../schema/ids';
import type {Screen} from '../schema/screens';
import {
  themeScreenLayoutSchema,
  type Theme,
  type ThemeScreenLayout,
  type ThemesFile,
} from '../schema/themes';
import {
  THEME_LIMITS,
  isStandbyElement,
  themeElementProblem,
  type ThemeItemKind,
} from './elementRules';
import {resolveThemeScreen} from './resolve';

export type ThemeEditProblem =
  | 'missing'
  | 'name'
  | 'taken'
  | 'full'
  | 'duplicate-id'
  | 'standby'
  | 'confirmation-required'
  | 'elements'
  | 'link'
  | 'invalid';
export type ThemeEditResult = Result<ThemesFile, ThemeEditProblem>;
export type ThemeScreenInfo = Pick<Screen, 'id' | 'kind'>;
export interface ThemeTarget {
  readonly theme: ThemeId;
  readonly screen: ThemeScreenInfo;
  readonly screens: readonly ThemeScreenInfo[];
}
export type ThemeListEdit =
  | {
      readonly kind: 'add';
      readonly id: ThemeId;
      readonly screens?: readonly ThemeScreenInfo[];
    }
  | {readonly kind: 'duplicate'; readonly id: ThemeId; readonly source: ThemeId}
  | {readonly kind: 'rename'; readonly id: ThemeId; readonly name: string}
  | {
      readonly kind: 'default';
      readonly id: ThemeId;
      readonly itemKind: ThemeItemKind;
    }
  | {
      readonly kind: 'delete';
      readonly id: ThemeId;
      readonly confirmed?: boolean;
    };

export function findTheme(file: ThemesFile, id: ThemeId): Theme | undefined {
  return file.standby.id === id
    ? file.standby
    : file.themes.find(theme => theme.id === id);
}

function replaceTheme(file: ThemesFile, theme: Theme): ThemesFile {
  return file.standby.id === theme.id
    ? {...file, standby: theme}
    : {
        ...file,
        themes: file.themes.map(value =>
          value.id === theme.id ? theme : value,
        ),
      };
}

function unusedName(base: string, file: ThemesFile, ending: string): string {
  const names = new Set(
    [file.standby, ...file.themes].map(theme => theme.name),
  );
  for (let index = 1; ; index++) {
    const suffix = ending + (index === 1 ? '' : ` ${index}`);
    const name = base.slice(0, THEME_LIMITS.name - suffix.length) + suffix;
    if (!names.has(name)) return name;
  }
}

/** Item references are supplied by the service usage reader; dangling IDs keep fallback behavior. */
export function editThemeList(
  file: ThemesFile,
  edit: ThemeListEdit,
  usedByItems: ReadonlySet<ThemeId>,
): ThemeEditResult {
  if (edit.kind === 'add' || edit.kind === 'duplicate') {
    if (file.themes.length >= THEME_LIMITS.themes) {
      return {ok: false, error: 'full'};
    }
    if (findTheme(file, edit.id) !== undefined) {
      return {ok: false, error: 'duplicate-id'};
    }
    const source =
      edit.kind === 'duplicate' ? findTheme(file, edit.source) : undefined;
    if (edit.kind === 'duplicate' && source === undefined) {
      return {ok: false, error: 'missing'};
    }
    const screens = edit.kind === 'add' ? (edit.screens ?? []) : [];
    if (screens.length > THEME_LIMITS.screens) {
      return {ok: false, error: 'full'};
    }
    const theme = {
      ...source,
      id: edit.id,
      name: unusedName(
        source?.name ?? '새 테마',
        file,
        source === undefined ? '' : ' 복사본',
      ),
      screens:
        source?.screens ??
        Object.fromEntries(
          screens.map(screen => [
            screen.id,
            {mode: {kind: 'own'}, elements: []} as const,
          ]),
        ),
    };
    return {ok: true, value: {...file, themes: [...file.themes, theme]}};
  }
  const theme = findTheme(file, edit.id);
  if (theme === undefined) return {ok: false, error: 'missing'};
  if (edit.kind === 'rename') {
    const name = edit.name.trim();
    if (theme.name === name) return {ok: true, value: file};
    if (name.length === 0 || name.length > THEME_LIMITS.name) {
      return {ok: false, error: 'name'};
    }
    if (
      [file.standby, ...file.themes].some(
        other => other.id !== theme.id && other.name === name,
      )
    ) {
      return {ok: false, error: 'taken'};
    }
    return {ok: true, value: replaceTheme(file, {...theme, name})};
  }
  if (theme.id === file.standby.id) return {ok: false, error: 'standby'};
  if (edit.kind === 'default') {
    if (file.defaults[edit.itemKind] === theme.id) {
      const {[edit.itemKind]: previous, ...defaults} = file.defaults;
      return {ok: true, value: {...file, defaults}};
    }
    return {
      ok: true,
      value: {...file, defaults: {...file.defaults, [edit.itemKind]: theme.id}},
    };
  }
  if (
    !edit.confirmed &&
    (Object.values(file.defaults).includes(theme.id) ||
      usedByItems.has(theme.id))
  ) {
    return {ok: false, error: 'confirmation-required'};
  }
  let defaults = file.defaults;
  for (const kind of ['song', 'bible', 'notice', 'media'] as const) {
    if (defaults[kind] === theme.id) {
      const {[kind]: removed, ...rest} = defaults;
      defaults = rest;
    }
  }
  return {
    ok: true,
    value: {
      ...file,
      defaults,
      themes: file.themes.filter(other => other.id !== theme.id),
    },
  };
}

export function themeLayout(
  file: ThemesFile,
  target: ThemeTarget,
): ThemeScreenLayout {
  return (
    findTheme(file, target.theme)?.screens[target.screen.id] ?? {
      mode: {kind: 'empty'},
      elements: [],
    }
  );
}

/** Validates layout edits at their owner, preserving retained elements in linked/empty modes. */
export function editThemeLayout(
  file: ThemesFile,
  target: ThemeTarget,
  change: (layout: ThemeScreenLayout) => unknown,
): ThemeEditResult {
  const {screens} = target;
  const theme = findTheme(file, target.theme);
  if (
    theme === undefined ||
    !screens.some(screen => screen.id === target.screen.id)
  ) {
    return {ok: false, error: 'missing'};
  }
  const parsed = checkPart(
    themeScreenLayoutSchema,
    change(themeLayout(file, target)),
  );
  if (!parsed.ok) return {ok: false, error: 'invalid'};
  const layout = parsed.value;
  if (themeElementProblem(layout.elements, target.screen.kind) !== undefined) {
    return {ok: false, error: 'elements'};
  }
  if (
    theme.id === file.standby.id &&
    layout.elements.some(element => !isStandbyElement(element.kind))
  ) {
    return {ok: false, error: 'standby'};
  }
  const next = {
    ...theme,
    screens: {...theme.screens, [target.screen.id]: layout},
  };
  if (Object.keys(next.screens).length > THEME_LIMITS.screens) {
    return {ok: false, error: 'full'};
  }
  if (
    layout.mode.kind === 'same' &&
    !validLink(next, target.screen.id, screens)
  ) {
    return {ok: false, error: 'link'};
  }
  return {ok: true, value: replaceTheme(file, next)};
}

function validLink(
  theme: Theme,
  id: ScreenId,
  screens: readonly ThemeScreenInfo[],
): boolean {
  const resolved = resolveThemeScreen(theme, id, screens);
  return resolved.sourceScreenId !== id;
}
