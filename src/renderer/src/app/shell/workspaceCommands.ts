import {shortcutText} from '@renderer/ui/commandBindings';
import {commandBindings} from '@core/shortcuts/bindings';
import {matchesBinding} from '@core/shortcuts/matching';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {useMacroPalette} from '@renderer/features/tools/state/macroPalette';
import {SHOW_TOOLS, type ShowTool} from '@renderer/features/tools/showTools';
import type {Workspace} from './Toolbar';
import type {WindowShortcut} from '../../platform/windowShortcuts';

interface WorkspaceActions {
  readonly onWorkspace: (workspace: Workspace) => void;
  readonly onMedia: () => void;
  readonly imported: boolean;
}

/** Decided ProPresenter workspace defaults, with imported-save precedence. */
export function workspaceShortcuts({
  onWorkspace,
  onMedia,
  imported,
}: WorkspaceActions): readonly WindowShortcut[] {
  return [
    {
      id: 'workspace.show',
      when: event =>
        !imported ||
        !commandBindings('import.save', commandBindingStore.get()).some(
          binding => matchesBinding(event, binding),
        ),
      run: () => onWorkspace('show'),
    },
    {id: 'workspace.prep', run: () => onWorkspace('prep')},
    {id: 'workspace.screens', run: () => window.llp?.window.openScreens()},
    ...SHOW_TOOLS.map(tool => ({
      id: toolCommands[tool.value],
      run: () => openTool(tool.value, onWorkspace),
    })),
    {id: 'tools.actionPalette', run: () => openPalette(onWorkspace)},
    {
      id: 'workspace.media',
      run: onMedia,
    },
  ];
}

function workspaceRow(
  row: {readonly id: Workspace; readonly label: string; readonly meta?: string},
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): MenuItem {
  return {
    kind: 'item',
    id: `workspace.${row.id}`,
    label: row.label,
    meta: shortcutText(`workspace.${row.id}`),
    command: `workspace.${row.id}`,
    ...menuAvailability(
      onWorkspace === undefined ? '작업 화면 연결 안 됨' : undefined,
    ),
    onSelect: () => onWorkspace?.(row.id),
  };
}

/** The 진행 도구 tabs the 보기 menu opens, in ProPresenter's View order. */
const VIEW_TOOLS: readonly ShowTool[] = [
  'audio',
  'stage',
  'timer',
  'message',
  'notice',
  'prop',
  'macro',
];

const toolCommands: Readonly<Record<ShowTool, string>> = {
  audio: 'tools.audio',
  stage: 'tools.stage',
  timer: 'tools.timers',
  message: 'tools.messages',
  notice: 'tools.notices',
  prop: 'tools.props',
  macro: 'tools.macros',
};

function openTool(
  tool: ShowTool,
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): void {
  useShowToolTab.getState().setTool(tool);
  onWorkspace?.('show');
}

function openPalette(
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): void {
  useMacroPalette.getState().show();
  openTool('macro', onWorkspace);
}

function toolRows(
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): readonly MenuItem[] {
  return VIEW_TOOLS.map(tool => ({
    kind: 'item',
    id: `tool.${tool}`,
    command: toolCommands[tool],
    label: SHOW_TOOLS.find(entry => entry.value === tool)?.label ?? tool,
    ...menuAvailability(
      onWorkspace === undefined ? '작업 화면 연결 안 됨' : undefined,
    ),
    onSelect: () => {
      openTool(tool, onWorkspace);
    },
  }));
}

/**
 * The 보기 menu, row for row as ProPresenter's View menu (spec 11): the
 * workspaces, playback, the 진행 도구 tabs, then the other views.
 */
export function workspaceMenu({
  onWorkspace,
  onMedia,
}: {
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onMedia: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    workspaceRow({id: 'show', label: '진행'}, onWorkspace),
    laterRow('workspace.slides', '슬라이드 편집기'),
    workspaceRow({id: 'prep', label: '준비'}, onWorkspace),
    laterRow('workspace.bible', '성경'),
    menuSeparator('playback'),
    laterRow('continuous', '이어서 진행'),
    menuSeparator('slide-view'),
    laterRow('slide-view', '슬라이드 보기', {submenu: true}),
    menuSeparator('tools'),
    ...toolRows(onWorkspace),
    menuSeparator('views'),
    laterRow('timecode', '타임코드'),
    {
      kind: 'item',
      id: 'workspace.media',
      label: '미디어',
      command: 'workspace.media',
      meta: shortcutText('workspace.media'),
      ...menuAvailability(
        onMedia === undefined ? '미디어 화면 연결 안 됨' : undefined,
      ),
      onSelect: onMedia,
    },
    laterRow('calendar', '캘린더'),
    {
      kind: 'item',
      id: 'palette',
      command: 'tools.actionPalette',
      label: '동작 팔레트',
      ...menuAvailability(
        onWorkspace === undefined ? '작업 화면 연결 안 됨' : undefined,
      ),
      onSelect: () => {
        openPalette(onWorkspace);
      },
    },
    laterRow('test-patterns', '테스트 화면'),
    menuSeparator('preview'),
    laterRow('preview', '미리보기', {submenu: true}),
    menuSeparator('full-screen'),
    laterRow('full-screen', '전체 화면'),
  ];
}
