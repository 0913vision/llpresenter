import {useSyncExternalStore} from 'react';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {parseScreenId} from '@core/schema/ids';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuShortcuts} from '@renderer/ui/useMenuShortcuts';
import {sendLookChange} from '@renderer/features/screens/looks/lookActions';
import {sendThemeChange} from '@renderer/features/screens/themeActions';
import {sendLive} from '@renderer/session/live';
import type {JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useLive, useOutputs} from '@renderer/session/live';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {useScreenSummaries} from '../../platform/ScreenSummaries';
import {outputMenuEntries} from './outputMenuEntries';
import type {WarningScreen} from './MenuBar';
import type {Workspace} from './Toolbar';

export function OutputMenuList({
  anchor,
  onClose,
  warnings,
  onShowWarning,
  onProblem,
  onWorkspace,
}: {
  readonly anchor: HTMLElement | null;
  readonly onClose: () => void;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onProblem: (notice: Notice) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
}): JSX.Element | null {
  const screens = useScreenSummaries();
  const outputs = useOutputs();
  const lookId = useLive(view =>
    view.state === null ? undefined : (view.state.lookId ?? null),
  );
  const stageLayouts = useLive(view => view.state?.stageLayouts);
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const needed =
    anchor !== null ||
    Object.keys(bindings).some(
      id =>
        /^(output.|look.|theme.|workspace.(looks|themes|stage)$)/.test(id) &&
        (bindings[id]?.length ?? 0) > 0,
    );
  const looks = useSettingsDocument(needed ? 'looks' : null, 'Look', onProblem);
  const themes = useSettingsDocument(
    needed ? 'themes' : null,
    '테마',
    onProblem,
  );
  const themeId = useLive(view => view.state?.themeOutput?.themeId);
  const hasItem = useLive(view => view.state?.themeItem != null);
  const layouts = useSettingsDocument(
    needed ? 'stage-layouts' : null,
    '무대 배치',
    onProblem,
  );
  const entries = outputMenuEntries({
    screens,
    outputs,
    themes: themes?.value ?? null,
    themeId,
    hasItem,
    looks: looks?.value ?? null,
    layouts: layouts?.value ?? null,
    lookId,
    stageLayouts,
    warnings,
    onShowWarning,
    onWorkspace,
    onProblem,
  });
  useMenuShortcuts(entries);
  useWindowShortcuts([
    {
      id: 'workspace.themes',
      when: () => onWorkspace !== undefined,
      run: () => onWorkspace?.('screens'),
    },
    ...(themes?.value.themes ?? []).map(theme => ({
      id: `theme.${theme.id}`,
      run: () => sendThemeChange(theme.id, onProblem),
    })),
    ...(looks?.value.looks ?? []).map(look => ({
      id: `look.${look.id}`,
      run: () => sendLookChange(look.id, onProblem),
    })),
    ...screens.map(screen => ({
      id: `output.screen.${screen.id}`,
      run: () => {
        const id = parseScreenId(screen.id);
        if (id.ok) {
          sendLive({
            type: 'output.set',
            screenId: id.value,
            on: outputs[screen.id] !== true,
          });
        }
      },
    })),
  ]);
  return anchor === null ? null : (
    <Menu
      label="출력"
      anchor={{kind: 'element', element: anchor}}
      onClose={onClose}
      entries={entries}
    />
  );
}
