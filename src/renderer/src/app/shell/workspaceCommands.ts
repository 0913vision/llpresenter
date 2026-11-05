import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
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
    {id: 'app.preferences', run: () => window.llp?.window.openPreferences()},
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
      onWorkspace === undefined ? NOT_IN_THIS_WINDOW : undefined,
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
  'prop',
  'macro',
];

const toolCommands: Readonly<Record<ShowTool, string>> = {
  audio: 'tools.audio',
  stage: 'tools.stage',
  timer: 'tools.timers',
  message: 'tools.messages',
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
      onWorkspace === undefined ? NOT_IN_THIS_WINDOW : undefined,
    ),
    onSelect: () => {
      openTool(tool, onWorkspace);
    },
  }));
}

/**
 * The 이어서 진행 row: a check that shows and flips 환경설정's choice of what
 * next does on the last 장 (on is 다음 항목).
 */
export interface ContinuousRow {
  readonly on: boolean;
  /** Why the row can't change, such as a file of a newer version. */
  readonly reason: string | undefined;
  readonly toggle: () => void;
}

/**
 * The 보기 menu, row for row as ProPresenter's View menu (spec 11): the
 * workspaces, playback, the 진행 도구 tabs, then the other views.
 */
export function workspaceMenu({
  onWorkspace,
  onMedia,
  continuous,
  testPattern,
  fullScreen,
}: {
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onMedia: (() => void) | undefined;
  readonly continuous: ContinuousRow;
  readonly testPattern: MenuItem;
  readonly fullScreen: MenuItem;
}): readonly MenuEntry[] {
  return [
    workspaceRow({id: 'show', label: '진행'}, onWorkspace),
    laterRow('workspace.slides', '슬라이드 편집기'),
    workspaceRow({id: 'prep', label: '준비'}, onWorkspace),
    laterRow('workspace.bible', '성경'),
    menuSeparator('playback'),
    {
      kind: 'item',
      id: 'continuous',
      label: '이어서 진행',
      check: 'checkbox',
      checked: continuous.on,
      ...menuAvailability(continuous.reason),
      onSelect: continuous.toggle,
    },
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
        onMedia === undefined ? NOT_IN_THIS_WINDOW : undefined,
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
        onWorkspace === undefined ? NOT_IN_THIS_WINDOW : undefined,
      ),
      onSelect: () => {
        openPalette(onWorkspace);
      },
    },
    testPattern,
    menuSeparator('preview'),
    laterRow('preview', '미리보기', {submenu: true}),
    menuSeparator('full-screen'),
    fullScreen,
  ];
}
