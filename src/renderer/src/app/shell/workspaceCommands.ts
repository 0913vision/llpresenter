import {isInTextEntry} from '@renderer/ui/textEntry';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
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
      code: 'KeyS',
      ctrl: true,
      when: () => !imported,
      run: () => onWorkspace('show'),
    },
    ...['KeyE', 'KeyR'].map(code => ({
      code,
      ctrl: true,
      run: () => onWorkspace('prep'),
    })),
    {code: 'Digit1', ctrl: true, alt: true, run: () => onWorkspace('screens')},
    {
      code: 'KeyV',
      ctrl: true,
      shift: true,
      when: event => !isInTextEntry(event.target),
      run: onMedia,
    },
  ];
}

function workspaceRow(
  row: {readonly id: Workspace; readonly label: string; readonly meta: string},
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): MenuItem {
  return {
    kind: 'item',
    id: `workspace.${row.id}`,
    label: row.label,
    meta: row.meta,
    disabled: onWorkspace === undefined,
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

function toolRows(
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): readonly MenuItem[] {
  return VIEW_TOOLS.map(tool => ({
    kind: 'item',
    id: `tool.${tool}`,
    label: SHOW_TOOLS.find(entry => entry.value === tool)?.label ?? tool,
    disabled: onWorkspace === undefined,
    onSelect: () => {
      useShowToolTab.getState().setTool(tool);
      onWorkspace?.('show');
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
    workspaceRow({id: 'show', label: '진행', meta: 'Ctrl S'}, onWorkspace),
    laterRow('workspace.slides', '슬라이드 편집기'),
    workspaceRow({id: 'prep', label: '준비', meta: 'Ctrl R'}, onWorkspace),
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
      meta: 'Ctrl Shift V',
      disabled: onMedia === undefined,
      onSelect: onMedia,
    },
    laterRow('calendar', '캘린더'),
    {
      kind: 'item',
      id: 'palette',
      label: '동작 팔레트',
      disabled: onWorkspace === undefined,
      onSelect: () => {
        useMacroPalette.getState().show();
        useShowToolTab.getState().setTool('macro');
        onWorkspace?.('show');
      },
    },
    laterRow('test-patterns', '테스트 화면'),
    menuSeparator('preview'),
    laterRow('preview', '미리보기', {submenu: true}),
    menuSeparator('full-screen'),
    laterRow('full-screen', '전체 화면'),
  ];
}
