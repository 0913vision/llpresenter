import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId, parseMediaId, type ThemeId} from '@core/schema/ids';
import type {ItemRow} from '@core/presentation/model';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import {
  withPreferenceDefaults,
  type StageLyricLabelPosition,
} from '@core/schema/preferences';
import type {LlpApi} from '@contracts/ipc/api';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {pictureSizeForScreen} from '@core/screens/pictureSize';

function pictureScreen(screen: Screen) {
  const pictureSize = pictureSizeForScreen(screen);
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    method: screen.method,
    ...(pictureSize === undefined ? {} : {pictureSize}),
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
  };
}

interface SlideThemeOptions {
  readonly role?: 'audience' | 'stage' | 'broadcast';
  readonly theme?: ThemeId;
  readonly screenId?: string;
  readonly stageLyricLabelPosition?: StageLyricLabelPosition | undefined;
}

export function useSlideTheme(
  row: ItemRow | undefined,
  source: 'service' | 'external' = 'service',
  options: SlideThemeOptions & {readonly api?: LlpApi} = {},
) {
  const enabled = row !== undefined && row.kind !== 'unknown';
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
  const preferences = useApiSettingsDocument({
    api,
    name: enabled && options.role === 'stage' ? 'preferences' : null,
    title: '????',
  });
  return slideTheme(row, {
    ...options,
    ...(preferences === null
      ? {}
      : {
          stageLyricLabelPosition: withPreferenceDefaults(preferences.value)
            .output.stageLyricLabelPosition,
        }),
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
  if (row === undefined || row.kind === 'unknown') return undefined;
  const kind = row.kind === 'slides' ? row.form : row.kind;
  const ownTheme =
    options.theme ?? (row.kind === 'bible' ? row.bible?.theme : row.theme);
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
  const item = {
    id: row.id,
    kind,
    source,
    title:
      row.kind === 'bible'
        ? (row.bible?.passage?.displayRef ?? row.title)
        : row.title,
    ...(backgroundOverride === undefined ? {} : {backgroundOverride}),
  } as const;
  const audienceScreen =
    screen.kind === 'stage'
      ? targets.find(target => target.kind === 'audience')
      : undefined;
  const audienceLayout =
    audienceScreen === undefined
      ? undefined
      : resolveThemeScreen(theme, audienceScreen.id, targets);
  const audience =
    audienceScreen === undefined || audienceLayout === undefined
      ? undefined
      : {
          screen: pictureScreen(audienceScreen),
          theme: {
            themeId: theme.id,
            revision: 0,
            missing: [],
            sourceScreenId: audienceLayout.sourceScreenId,
            layout: audienceLayout.layout,
            emptyColor: emptyScreenColor(
              targets.find(
                target => target.id === audienceLayout.sourceScreenId,
              ) ?? audienceScreen,
            ),
            item,
          },
        };
  return {
    themeId: theme.id,
    sourceScreenId: resolved.sourceScreenId,
    screen: pictureScreen(screen),
    ...(audience === undefined ? {} : {audience}),
    ...(screen.kind === 'stage' && options.stageLyricLabelPosition !== undefined
      ? {stageLyricLabelPosition: options.stageLyricLabelPosition}
      : {}),
    layout: resolved.layout,
    emptyColor: emptyScreenColor(
      targets.find(target => target.id === resolved.sourceScreenId) ?? screen,
    ),
    item,
    background: background?.mediaId,
  };
}
