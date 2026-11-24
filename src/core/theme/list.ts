import {copyName} from '@core/common/copyName';
import {freeName} from '@core/common/freeName';
import {moveSelection} from '@core/common/selectionOrder';
import type {Result} from '@core/common/result';
import type {ThemeId} from '@core/schema/common/ids';
import {
  THEME_FILE_LIMITS,
  type SlidePurpose,
  type ThemeFile,
} from '@core/schema/screens/theme';
import {THEMES_LIMITS, type Themes} from '@core/schema/screens/themes';
import {builtInTheme, themeFor} from './themes';

const NEW_THEME_NAME = '새 테마';

/**
 * Why a theme list edit was refused: the theme is missing, its name is blank or
 * too long, its name is taken, the list is full, or a built-in theme cannot be
 * deleted.
 */
export type ThemeListProblem = 'missing' | 'name' | 'taken' | 'full' | 'own';

/** One change to the theme list. */
export type ThemeListEdit =
  | {readonly kind: 'add'; readonly theme: ThemeFile; readonly after: ThemeId}
  | {readonly kind: 'replace'; readonly theme: ThemeFile}
  | {readonly kind: 'rename'; readonly id: ThemeId; readonly name: string}
  | {
      readonly kind: 'move';
      readonly id: ThemeId;
      readonly before: ThemeId | null;
    }
  | {readonly kind: 'default'; readonly id: ThemeId}
  | {readonly kind: 'restore'; readonly id: ThemeId}
  | {readonly kind: 'delete'; readonly id: ThemeId};

/** The theme list after an edit, or the reason it was refused. */
export type ThemeListResult = Result<Themes, ThemeListProblem>;

type ThemeList = Pick<Themes, 'themes' | 'defaults'>;

function namesOf({themes}: Pick<Themes, 'themes'>): readonly string[] {
  return themes.map(theme => theme.name);
}

/** A new theme for a purpose, which starts as the one in use for it. */
export function newTheme(
  list: ThemeList,
  purpose: SlidePurpose,
  id: ThemeId,
): ThemeFile {
  return {
    ...themeFor(list, purpose),
    id,
    name: freeName(NEW_THEME_NAME, new Set(namesOf(list))),
  };
}

/** The name of a copy of a theme. */
export function copiedThemeName(list: ThemeList, name: string): string {
  return copyName(name, namesOf(list), {maxLength: THEME_FILE_LIMITS.name});
}

/** How many themes are the operator's own. */
export function ownThemeCount({themes}: Pick<Themes, 'themes'>): number {
  return themes.filter(theme => builtInTheme(theme.id) === undefined).length;
}

function replaced(list: Themes, theme: ThemeFile): ThemeListResult {
  return list.themes.some(entry => entry.id === theme.id)
    ? {
        ok: true,
        value: {
          ...list,
          themes: list.themes.map(entry =>
            entry.id === theme.id ? theme : entry,
          ),
        },
      }
    : {ok: false, error: 'missing'};
}

function nameProblem(
  list: Themes,
  name: string,
  id: ThemeId,
): ThemeListProblem | undefined {
  if (name.trim() === '' || name.length > THEME_FILE_LIMITS.name) return 'name';
  return list.themes.some(theme => theme.id !== id && theme.name === name)
    ? 'taken'
    : undefined;
}

/** Applies one change to the list of themes. */
export function editThemeList(
  list: Themes,
  edit: ThemeListEdit,
): ThemeListResult {
  if (edit.kind === 'replace') return replaced(list, edit.theme);
  const id = edit.kind === 'add' ? edit.after : edit.id;
  const theme = list.themes.find(entry => entry.id === id);
  if (theme === undefined) return {ok: false, error: 'missing'};
  const own = builtInTheme(id);
  switch (edit.kind) {
    case 'add': {
      if (ownThemeCount(list) >= THEMES_LIMITS.themes) {
        return {ok: false, error: 'full'};
      }
      const problem = nameProblem(list, edit.theme.name, edit.theme.id);
      if (problem !== undefined) return {ok: false, error: problem};
      return {
        ok: true,
        value: {
          ...list,
          themes: list.themes.flatMap(entry =>
            entry.id === edit.after ? [entry, edit.theme] : [entry],
          ),
        },
      };
    }
    case 'rename': {
      const name = edit.name.trim();
      const problem = nameProblem(list, name, id);
      return problem === undefined
        ? replaced(list, {...theme, name})
        : {ok: false, error: problem};
    }
    case 'move': {
      const boundary =
        edit.before === null
          ? list.themes.length
          : list.themes.findIndex(entry => entry.id === edit.before);
      return {
        ok: true,
        value: {
          ...list,
          themes: [...moveSelection(list.themes, new Set([id]), boundary)],
        },
      };
    }
    case 'default':
      return {
        ok: true,
        value: {...list, defaults: {...list.defaults, [theme.purpose]: id}},
      };
    case 'restore':
      return own === undefined ? {ok: true, value: list} : replaced(list, own);
    case 'delete': {
      if (own !== undefined) return {ok: false, error: 'own'};
      const {[theme.purpose]: chosen, ...others} = list.defaults;
      const defaults = chosen === id ? others : list.defaults;
      return {
        ok: true,
        value: {
          ...list,
          defaults,
          themes: list.themes.filter(entry => entry.id !== id),
        },
      };
    }
  }
}
