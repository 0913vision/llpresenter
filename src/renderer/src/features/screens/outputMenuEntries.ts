import {shortcutText} from '@renderer/ui/commandBindings';
import {parseScreenId, type LookId, type ThemeId} from '@core/schema/ids';
import type {LooksFile} from '@core/schema/looks';
import type {ThemesFile} from '@core/schema/themes';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {LiveState} from '@core/live/state';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {sendLive} from '@renderer/session/live';
import {
  outputGroup,
  itemStopEntry,
} from '@renderer/features/presentation/outputControlEntries';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {Notice} from '@renderer/ui/notices';
import type {ScreenSummary} from '@renderer/platform/screens';
import {sendThemeChange} from './themeActions';
import {useScreensSelection} from './selection';
import {liveThemeName, themeMenuEntries} from './themeMenuEntries';

/** Screen/live/settings snapshots and an app-owned editor navigation callback. */
export interface ScreenOutputInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly looks: LooksFile | null;
  readonly themes: ThemesFile | null;
  readonly themeId: ThemeId | undefined;
  readonly hasItem: boolean;
  readonly layouts: StageLayoutsFile | null;
  readonly lookId: LookId | null | undefined;
  readonly stageLayouts: LiveState['stageLayouts'];
  readonly onEditScreens: (() => void) | undefined;
  readonly onProblem: (notice: Notice) => void;
}

/** Ordered feature contributions; app warnings precede the settings section. */
export interface ScreenOutputSections {
  readonly audience: readonly MenuEntry[];
  readonly stage: readonly MenuEntry[];
  readonly broadcast: readonly MenuEntry[];
  readonly settings: readonly MenuEntry[];
}

function screenId(id: string) {
  const canonical =
    Object.entries(STARTER_SCREEN_IDS).find(([alias]) => alias === id)?.[1] ??
    id;
  const parsed = parseScreenId(canonical);
  return parsed.ok ? parsed.value : undefined;
}

/** Builds existing screen and theme choices without app navigation types. */
export function screenOutputSections(
  input: ScreenOutputInput,
): ScreenOutputSections {
  const {
    screens,
    outputs,
    looks,
    layouts,
    lookId,
    stageLayouts,
    onEditScreens,
  } = input;
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
    if (id === undefined || onEditScreens === undefined) return;
    useScreensSelection.getState().select(kind, id);
    onEditScreens();
  };
  const layout = stage
    .map(currentLayout)
    .find(id => layouts?.layouts.some(item => item.id === id));
  const capture = outputGroup(captions, outputs);
  return {
    audience: [
      {kind: 'group', id: 'audience', label: '본 화면'},
      {
        ...outputGroup(audience, outputs),
        id: 'audience-output',
        command: 'output.audience',
      },
      {
        kind: 'item',
        id: 'theme',
        label: `테마 바꾸기: ${liveThemeName(input.themes, input.themeId)}`,
        loadSubmenu: () =>
          themeMenuEntries({
            themes: input.themes?.themes ?? [],
            current: input.themeId,
            choose: themeId => sendThemeChange(themeId, input.onProblem),
            edit: onEditScreens,
          }),
      },
      itemStopEntry(input.hasItem),
    ],
    stage: [
      menuSeparator('stage'),
      {kind: 'group', id: 'stage-group', label: '무대 화면'},
      {
        ...outputGroup(stage, outputs),
        id: 'stage-output',
        command: 'output.stage',
      },
      ...stage.map((screen): MenuItem => {
        const target = screenId(screen.id);
        const id = currentLayout(screen);
        const selected = layouts?.layouts.find(item => item.id === id);
        return {
          kind: 'item',
          id: `layout:${screen.id}`,
          label: `${screen.statusLabel}: ${selected ? selected.name || '이름 없음' : id ? '삭제된 배치' : '없음'}`,
          ...menuAvailability(
            target === undefined
              ? '화면을 찾을 수 없음'
              : layouts === null
                ? '무대 배치 불러오는 중'
                : layouts.layouts.length === 0
                  ? '무대 배치 없음'
                  : undefined,
          ),
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
        ...menuAvailability(
          onEditScreens === undefined
            ? '화면 설정 연결 안 됨'
            : layout === undefined
              ? '선택한 배치 없음'
              : undefined,
        ),
        onSelect: () => edit('stage', layout),
      },
    ],
    broadcast: [
      menuSeparator('broadcast'),
      {kind: 'group', id: 'broadcast-group', label: '방송 자막'},
      {...capture, id: 'broadcast'},
      laterRow('broadcast-settings', '방송 설정…'),
    ],
    settings: [
      menuSeparator('screens'),
      {
        kind: 'item',
        id: 'screens',
        label: '화면 설정…',
        command: 'workspace.screens',
        meta: shortcutText('workspace.screens'),
        ...menuAvailability(
          window.llp === undefined ? '화면 설정 연결 안 됨' : undefined,
        ),
        onSelect: () => window.llp?.window.openScreens(),
      },
    ],
  };
}
