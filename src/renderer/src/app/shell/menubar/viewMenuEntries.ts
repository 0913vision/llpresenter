import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import {shortcutText} from '@renderer/ui/keys/commandBindings';
import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menus/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menus/menuRows';
import {showTool, type ShowTool} from '@renderer/features/tools/showTools';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';
import {openPalette, openTool, TOOL_COMMANDS} from './showToolCommands';

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
export function viewMenuEntries({
  onWorkspace,
  onMedia,
  fullScreen,
}: {
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onMedia: (() => void) | undefined;
  readonly fullScreen: MenuItem;
}): readonly MenuEntry[] {
  return [
    workspaceRow({id: 'show', label: '진행'}, onWorkspace),
    laterRow('workspace.slides', '슬라이드 편집기'),
    workspaceRow({id: 'prep', label: '준비'}, onWorkspace),
    laterRow('workspace.bible', '성경'),
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
    menuSeparator('preview'),
    laterRow('preview', '미리보기', {submenu: true}),
    menuSeparator('full-screen'),
    fullScreen,
    {
      kind: 'item',
      id: 'reset-columns',
      label: '칸 배치 초기화',
      onSelect: () => window.dispatchEvent(new Event('llp-reset-columns')),
    },
  ];
}

/** The rows of the 보기 menu that belong to 진행. */
export function showViewMenuEntries(
  continuous: ContinuousRow,
  continuousGrid: ContinuousRow,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'continuous',
      label: '마지막 슬라이드에서 다음 항목으로',
      check: 'checkbox',
      checked: continuous.on,
      ...menuAvailability(continuous.reason),
      onSelect: continuous.toggle,
    },
    {
      kind: 'item',
      id: 'continuous-grid',
      label: '이어서 보여 주기',
      check: 'checkbox',
      checked: continuousGrid.on,
      ...menuAvailability(continuousGrid.reason),
      onSelect: continuousGrid.toggle,
    },
  ];
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

function toolRows(
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): readonly MenuItem[] {
  return VIEW_TOOLS.map(tool => ({
    kind: 'item',
    id: `tool.${tool}`,
    command: TOOL_COMMANDS[tool],
    label: showTool(tool).label,
    ...menuAvailability(
      onWorkspace === undefined ? NOT_IN_THIS_WINDOW : undefined,
    ),
    onSelect: () => {
      openTool(tool, onWorkspace);
    },
  }));
}
