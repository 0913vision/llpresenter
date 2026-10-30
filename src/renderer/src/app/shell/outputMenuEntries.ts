import {parseScreenId, type LookId} from '@core/schema/ids';
import type {LooksFile} from '@core/schema/looks';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {LiveState} from '@core/live/state';
import {MAX_LIVE_BATCH_COMMANDS} from '@core/schema/liveCommand';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {sendLive} from '@renderer/session/live';
import {useScreensSelection} from '@renderer/features/screens/selection';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {Notice} from '@renderer/ui/notices';
import {sendLookChange} from '../../features/screens/looks/lookActions';
import type {ScreenSummary} from '../../platform/screens';
import type {Workspace} from './Toolbar';
import type {WarningScreen} from './MenuBar';

interface OutputMenuInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly looks: LooksFile | null;
  readonly layouts: StageLayoutsFile | null;
  readonly lookId: LookId | null | undefined;
  readonly stageLayouts: LiveState['stageLayouts'];
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onProblem: (notice: Notice) => void;
}

function screenId(id: string) {
  const canonical =
    Object.entries(STARTER_SCREEN_IDS).find(([alias]) => alias === id)?.[1] ??
    id;
  const parsed = parseScreenId(canonical);
  return parsed.ok ? parsed.value : undefined;
}

function outputGroup(
  screens: readonly ScreenSummary[],
  outputs: OutputMenuInput['outputs'],
): MenuItem {
  const on = screens.some(screen => outputs[screen.id] === true);
  return {
    kind: 'item',
    id: 'output',
    label: on ? '출력 끄기' : '출력 켜기',
    disabled: screens.length === 0,
    title: screens.length === 0 ? '화면이 없습니다' : undefined,
    onSelect: () => {
      const commands = screens.map(screen => ({
        type: 'output.set' as const,
        screenId: screen.id,
        on: !on,
      }));
      for (let at = 0; at < commands.length; at += MAX_LIVE_BATCH_COMMANDS) {
        sendLive({
          type: 'live.batch',
          commands: commands.slice(at, at + MAX_LIVE_BATCH_COMMANDS),
        });
      }
    },
  };
}

/** Spec 11's grouped output commands, active Look/layout choices, and warnings. */
export function outputMenuEntries(
  input: OutputMenuInput,
): readonly MenuEntry[] {
  const {screens, outputs, looks, layouts, lookId, stageLayouts, onWorkspace} =
    input;
  const current =
    looks?.looks.find(look => look.id === lookId) ??
    looks?.looks.find(look => look.id === looks.current);
  const audience = screens.filter(screen => screen.kind !== 'stage');
  const stage = screens.filter(screen => screen.kind === 'stage');
  const captions = audience.filter(
    screen =>
      screen.id === STARTER_SCREEN_IDS.broadcast ||
      screen.id === 'broadcast' ||
      screen.id === 'captions' ||
      screen.targetKind === 'capture' ||
      screen.targetKind === 'ndi',
  );
  const currentLayout = (screen: ScreenSummary) => {
    const id = screenId(screen.id);
    return id === undefined
      ? undefined
      : (stageLayouts?.[id] ?? current?.screens[id]?.stageLayout);
  };
  const edit = (kind: 'look' | 'stage', id: string | undefined): void => {
    if (id === undefined || onWorkspace === undefined) return;
    useScreensSelection.getState().select(kind, id);
    onWorkspace('screens');
  };
  const layout = stage
    .map(currentLayout)
    .find(id => layouts?.layouts.some(item => item.id === id));
  const warningRows = input.warnings.map(
    ({screenId, screenName}): MenuEntry => {
      const role = screenId === 'captions' ? 'broadcast' : screenId;
      const canonicalId =
        Object.entries(STARTER_SCREEN_IDS).find(
          ([alias]) => alias === role,
        )?.[1] ?? screenId;
      return {
        kind: 'item',
        id: `warning:${screenId}`,
        label: `${screens.find(screen => screen.id === canonicalId)?.statusLabel ?? screenName} 경고 보기`,
        onSelect: () => input.onShowWarning(screenId),
      };
    },
  );
  const capture = outputGroup(captions, outputs);
  return [
    {kind: 'group', id: 'audience', label: '본 화면'},
    {...outputGroup(audience, outputs), id: 'audience-output'},
    {
      kind: 'item',
      id: 'look',
      label: `Look: ${current ? current.name || '이름 없는 Look' : '없음'}`,
      disabled: !looks?.looks.length,
      loadSubmenu: () =>
        looks?.looks.map(look => ({
          kind: 'item',
          id: look.id,
          label: look.name || '이름 없는 Look',
          check: 'radio',
          checked: lookId !== undefined && look.id === current?.id,
          onSelect: () => sendLookChange(look.id, input.onProblem),
        })) ?? [],
    },
    {
      kind: 'item',
      id: 'edit-look',
      label: 'Look 편집…',
      disabled: current === undefined || onWorkspace === undefined,
      onSelect: () => edit('look', current?.id),
    },
    menuSeparator('stage'),
    {kind: 'group', id: 'stage-group', label: '무대 화면'},
    {...outputGroup(stage, outputs), id: 'stage-output'},
    ...stage.map((screen): MenuItem => {
      const target = screenId(screen.id);
      const id = currentLayout(screen);
      const selected = layouts?.layouts.find(item => item.id === id);
      return {
        kind: 'item',
        id: `layout:${screen.id}`,
        label: `${screen.statusLabel}: ${selected ? selected.name || '이름 없음' : id ? '삭제된 배치' : '없음'}`,
        disabled: target === undefined || !layouts?.layouts.length,
        loadSubmenu: () =>
          layouts?.layouts.map(item => ({
            kind: 'item',
            id: item.id,
            label: item.name || '이름 없음',
            check: 'radio',
            checked: item.id === id,
            onSelect: () => {
              if (target === undefined) return;
              sendLive({
                type: 'stage.layout.set',
                screenId: target,
                layoutId: item.id,
              });
            },
          })) ?? [],
      };
    }),
    {
      kind: 'item',
      id: 'edit-layout',
      label: '무대 배치 편집…',
      disabled: layout === undefined || onWorkspace === undefined,
      onSelect: () => edit('stage', layout),
    },
    menuSeparator('screens'),
    {
      kind: 'item',
      id: 'screens',
      label: '화면 설정…',
      meta: 'Ctrl Alt 1',
      disabled: onWorkspace === undefined,
      onSelect: () => onWorkspace?.('screens'),
    },
    menuSeparator('broadcast'),
    {
      ...capture,
      id: 'broadcast',
      label: '방송 자막 켜기',
      check: 'checkbox',
      checked: captions.some(screen => outputs[screen.id] === true),
    },
    laterRow('broadcast-settings', '방송 설정…'),
    ...(warningRows.length > 0
      ? [menuSeparator('warnings'), ...warningRows]
      : []),
  ];
}
