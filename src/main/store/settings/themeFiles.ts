import {join} from 'node:path';
import type {Result} from '@core/common/result';
import {sameJson} from '@core/common/sameJson';
import type {FileError} from '@core/schema/common/fileFormat';
import {
  parseTheme,
  serializeTheme,
  type ThemeFile,
} from '@core/schema/screens/theme';
import {
  parseThemeList,
  serializeThemeList,
  type Themes,
} from '@core/schema/screens/themes';
import {BUILT_IN_THEMES, builtInTheme} from '@core/theme';
import {loadFolder} from '../files/library';
import type {SaveRequest} from '../files/saver';

const THEME_EXTENSION = '.lltheme';

/** The folder that has a file for each theme the operator made or changed. */
export function themeFolder(settings: string): string {
  return join(settings, 'themes');
}

function themeFile(settings: string, id: string): string {
  return join(themeFolder(settings), `${id}${THEME_EXTENSION}`);
}

/** Puts the app's own themes and the operator's in the order of the list. */
export function arrangeThemes(
  own: readonly ThemeFile[],
  order: readonly string[],
): readonly ThemeFile[] {
  const changed = new Map(own.map(theme => [theme.id, theme]));
  const all = [
    ...BUILT_IN_THEMES.map(theme => changed.get(theme.id) ?? theme),
    ...own.filter(theme => builtInTheme(theme.id) === undefined),
  ];
  const positions = new Map(order.map((id, index) => [id, index]));
  return all
    .map((theme, index) => ({theme, index}))
    .sort(
      (a, b) =>
        (positions.get(a.theme.id) ?? order.length + a.index) -
        (positions.get(b.theme.id) ?? order.length + b.index),
    )
    .map(({theme}) => theme);
}

/** Reads the operator's themes. A file that fails is left out and reported. */
export async function readThemes(settings: string): Promise<{
  readonly themes: readonly ThemeFile[];
  readonly problems: readonly FileError[];
}> {
  const read = await loadFolder(themeFolder(settings), THEME_EXTENSION, {
    parse: parseTheme,
  });
  return {
    themes: [...read.items.values()].map(({data}) => data),
    problems: read.problems,
  };
}

/** Whether a theme has a file: the app's own has one only when it is changed. */
function isKept(theme: ThemeFile): boolean {
  const own = builtInTheme(theme.id);
  return own === undefined || !sameJson(own, theme);
}

export interface ThemeWrites {
  readonly saves: readonly SaveRequest[];
  readonly removals: ReadonlyArray<SaveRequest['target']>;
}

/** What to write so that the files hold these themes instead of those. */
export function themeWrites(
  before: Themes,
  after: Themes,
  settings: string,
): Result<ThemeWrites, FileError> {
  const listFile = join(settings, 'themes.json');
  const {themes, ...list} = after;
  const text = serializeThemeList(
    {...list, order: themes.map(theme => theme.id)},
    listFile,
  );
  if (!text.ok) return text;
  const saves: SaveRequest[] = [
    {
      target: {file: listFile, kind: 'settings', id: 'themes'},
      text: text.value,
    },
  ];
  const old = new Map(before.themes.map(theme => [theme.id, theme]));
  const kept = new Set<string>();
  for (const theme of themes) {
    if (!isKept(theme)) continue;
    kept.add(theme.id);
    const previous = old.get(theme.id);
    if (
      previous !== undefined &&
      isKept(previous) &&
      sameJson(previous, theme)
    ) {
      continue;
    }
    const file = themeFile(settings, theme.id);
    const written = serializeTheme(theme, file);
    if (!written.ok) return written;
    saves.push({
      target: {file, kind: 'theme', id: theme.id},
      text: written.value,
    });
  }
  return {
    ok: true,
    value: {
      saves,
      removals: before.themes
        .filter(theme => isKept(theme) && !kept.has(theme.id))
        .map(theme => ({
          file: themeFile(settings, theme.id),
          kind: 'theme',
          id: theme.id,
        })),
    },
  };
}

/** The themes as an app without any of the operator's has them. */
export const DEFAULT_THEMES: Themes = {
  format: 'llsettings.themes',
  schemaVersion: 1,
  defaults: {},
  titles: [],
  themes: BUILT_IN_THEMES,
};

export {parseThemeList};
