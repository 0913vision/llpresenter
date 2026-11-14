import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId, type ThemeId} from '@core/schema/ids';
import type {ItemRow} from '@core/presentation/model';
import type {Screen} from '@core/schema/screens';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';

export function useSlideTheme(
  row: ItemRow | undefined,
  source: 'service' | 'external' = 'service',
  options: {
    readonly role?: 'audience' | 'stage' | 'broadcast';
    readonly theme?: ThemeId;
    readonly screenId?: string;
  } = {},
) {
  const enabled =
    row?.kind === 'slides' || row?.kind === 'song' || row?.kind === 'media';
  const file = useSettingsDocument(
    enabled ? 'themes' : null,
    '테마',
    undefined,
  );
  const screens = useSettingsDocument(
    enabled ? 'screens' : null,
    '화면',
    undefined,
  );
  if (row?.kind !== 'slides' && row?.kind !== 'song' && row?.kind !== 'media') {
    return undefined;
  }
  const kind =
    row.kind === 'slides' ? row.form : row.kind === 'song' ? 'song' : 'media';
  const ownTheme =
    options.theme ??
    (row.kind === 'song' || row.kind === 'slides' ? row.theme : undefined);
  const targets: readonly Screen[] = screens?.value.screens ?? [
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
    file: file?.value,
    kind,
    source,
    ...(ownTheme === undefined ? {} : {theme: ownTheme}),
    screens: targets,
  });
  const resolved = resolveThemeScreen(theme, screen.id, targets);
  return {
    themeId: theme.id,
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
    } as const,
    background:
      row.kind === 'song' || row.kind === 'slides'
        ? row.background?.mediaId
        : undefined,
  };
}
