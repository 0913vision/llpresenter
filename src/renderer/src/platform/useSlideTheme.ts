import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId} from '@core/schema/ids';
import type {ItemRow} from '@core/presentation/model';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';

export function useSlideTheme(
  row: ItemRow | undefined,
  source: 'service' | 'external' = 'service',
) {
  const enabled = row?.kind === 'slides' || row?.kind === 'song';
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
  if (row?.kind !== 'slides' && row?.kind !== 'song') return undefined;
  const kind = row.kind === 'slides' ? row.form : row.kind;
  const targets = screens?.value.screens ?? [
    {
      id: createScreenId(STARTER_SCREEN_IDS.main),
      kind: 'audience',
      method: 'fullscreen',
    } as const,
  ];
  const screen =
    targets.find(target => target.kind === 'audience') ?? targets[0];
  if (screen === undefined) return undefined;
  const theme = resolveItemTheme({
    file: file?.value,
    kind,
    source,
    ...(row.theme === undefined ? {} : {theme: row.theme}),
    screens: targets,
  });
  const resolved = resolveThemeScreen(theme, screen.id, targets);
  return {
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
    background: row.background?.mediaId,
  };
}
