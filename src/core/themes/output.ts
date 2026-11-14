import type {Screen} from '../schema/screens';
import type {ThemesFile} from '../schema/themes';
import type {
  LiveThemeItem,
  LiveThemeMode,
  LiveThemeOutput,
} from '../schema/liveTheme';
import {createDefaultThemes, withStageStandby} from './defaults';
export {withStageStandby} from './defaults';
import {resolveItemTheme, resolveThemeScreen} from './resolve';
import {emptyScreenColor} from '../screens/emptyColor';

/** Resolves one immutable composition for every configured output and preview. */
export function resolveThemeOutput({
  file,
  screens,
  item,
  mode,
  revision,
}: {
  readonly file: ThemesFile | null;
  readonly screens: readonly Screen[];
  readonly item: LiveThemeItem | null;
  readonly mode?: LiveThemeMode | undefined;
  readonly revision: number;
}): LiveThemeOutput {
  const missing: string[] = [];
  const kind = item?.kind ?? 'song';
  const requested =
    mode?.kind === 'manual'
      ? mode.id
      : item?.source === 'service'
        ? item.theme
        : undefined;
  const chosen =
    requested !== undefined && file?.standby.id === requested
      ? withStageStandby(file.standby, screens)
      : file?.themes.find(theme => theme.id === requested);
  if (requested !== undefined && chosen === undefined) missing.push(requested);
  const defaultId = file?.defaults[kind];
  if (
    item !== null &&
    chosen === undefined &&
    (defaultId === undefined ||
      !file?.themes.some(theme => theme.id === defaultId))
  ) {
    missing.push(defaultId ?? `default:${kind}`);
  }
  const theme =
    chosen ??
    (item === null
      ? withStageStandby(
          file?.standby ?? createDefaultThemes(screens).standby,
          screens,
        )
      : resolveItemTheme({
          file,
          kind,
          source: mode?.kind === 'manual' ? 'external' : item.source,
          ...(item.theme === undefined ? {} : {theme: item.theme}),
          screens,
        }));
  return {
    themeId: theme.id,
    ...(theme.transition === undefined ? {} : {transition: theme.transition}),
    revision,
    missing: missing.slice(0, 2),
    screens: Object.fromEntries(
      screens.map(screen => {
        const resolved = resolveThemeScreen(theme, screen.id, screens);
        const source =
          screens.find(candidate => candidate.id === resolved.sourceScreenId) ??
          screen;
        return [screen.id, {...resolved, emptyColor: emptyScreenColor(source)}];
      }),
    ),
  };
}
