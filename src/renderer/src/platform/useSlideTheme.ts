import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId, parseMediaId, type ThemeId} from '@core/schema/ids';
import type {ItemRow} from '@core/presentation/model';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import type {LlpApi} from '@contracts/ipc/api';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';

interface SlideThemeOptions {
  readonly role?: 'audience' | 'stage' | 'broadcast';
  readonly theme?: ThemeId;
  readonly screenId?: string;
}

export function useSlideTheme(
  row: ItemRow | undefined,
  source: 'service' | 'external' = 'service',
  options: SlideThemeOptions & {
    readonly api?: Pick<LlpApi, 'settings'> & Partial<Pick<LlpApi, 'log'>>;
  } = {},
) {
  const enabled =
    row?.kind === 'slides' || row?.kind === 'song' || row?.kind === 'media';
  const api = options.api ?? window.llp;
  const file = useApiSettingsDocument({
    api,
    name: enabled ? 'themes' : null,
    title: '테마',
  });
  const screens = useApiSettingsDocument({
    api,
    name: enabled ? 'screens' : null,
    title: '화면',
  });
  return slideTheme(row, {
    ...options,
    source,
    file: file?.value,
    screens: screens?.value.screens,
  });
}

/** Resolves a tile using the service's already-followed theme and screen settings. */
export function slideTheme(
  row: ItemRow | undefined,
  {
    source,
    file,
    screens,
    ...options
  }: SlideThemeOptions & {
    readonly source: 'service' | 'external';
    readonly file: ThemesFile | undefined;
    readonly screens: readonly Screen[] | undefined;
  },
) {
  if (row?.kind !== 'slides' && row?.kind !== 'song' && row?.kind !== 'media') {
    return undefined;
  }
  const kind =
    row.kind === 'slides' ? row.form : row.kind === 'song' ? 'song' : 'media';
  const ownTheme =
    options.theme ??
    (row.kind === 'song' || row.kind === 'slides' ? row.theme : undefined);
  const targets: readonly Screen[] = screens ?? [
    {
      id: createScreenId(STARTER_SCREEN_IDS.main),
      name: '청중',
      kind: 'audience',
      method: 'fullscreen',
    } as const,
  ];
  const screen =
    targets.find(
      target =>
        target.id === options.screenId &&
        target.kind === (options.role ?? 'audience'),
    ) ??
    targets.find(target => target.kind === (options.role ?? 'audience')) ??
    targets[0];
  if (screen === undefined) return undefined;
  const theme = resolveItemTheme({
    file,
    kind,
    source,
    ...(ownTheme === undefined ? {} : {theme: ownTheme}),
    screens: targets,
  });
  const resolved = resolveThemeScreen(theme, screen.id, targets);
  const background = row.background;
  const chosenBackground =
    background === undefined ? undefined : parseMediaId(background.mediaId);
  const backgroundOverride = row.backgroundNone
    ? {kind: 'none' as const}
    : chosenBackground?.ok === true && background !== undefined
      ? {
          kind: 'media' as const,
          mediaId: chosenBackground.value,
          loop: background.loop,
        }
      : undefined;
  return {
    themeId: theme.id,
    sourceScreenId: resolved.sourceScreenId,
    screen: {
      id: screen.id,
      name: screen.name,
      kind: screen.kind,
      method: screen.method,
      ...(screen.songCaption === undefined
        ? {}
        : {songCaption: screen.songCaption}),
      ...((screen.edgeMargin ?? 0) !== 0 ||
      (screen.offset?.x ?? 0) !== 0 ||
      (screen.offset?.y ?? 0) !== 0
        ? {
            correction: {
              edgeMargin: screen.edgeMargin ?? 0,
              offset: screen.offset ?? {x: 0, y: 0},
            },
          }
        : {}),
    },
    layout: resolved.layout,
    emptyColor: emptyScreenColor(
      targets.find(target => target.id === resolved.sourceScreenId) ?? screen,
    ),
    item: {
      id: row.id,
      kind,
      source,
      title: row.title,
      ...(backgroundOverride === undefined ? {} : {backgroundOverride}),
    } as const,
    background: background?.mediaId,
  };
}
