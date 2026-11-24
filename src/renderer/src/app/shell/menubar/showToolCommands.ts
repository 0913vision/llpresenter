import {useShowToolTab} from '@renderer/features/tools/showToolTab';
import {useMacroPalette} from '@renderer/features/tools/macros/actions/useMacroPalette';
import type {ShowTool} from '@renderer/features/tools/showTools';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';

/** The command that opens each 진행 도구 tab, for its shortcut and its 보기 row. */
export const TOOL_COMMANDS: Readonly<Record<ShowTool, string>> = {
  audio: 'tools.audio',
  stage: 'tools.stage',
  timer: 'tools.timers',
  message: 'tools.messages',
  prop: 'tools.props',
  macro: 'tools.macros',
};

/** Opens a 진행 도구 tab in 진행. */
export function openTool(
  tool: ShowTool,
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): void {
  useShowToolTab.getState().setTool(tool);
  onWorkspace?.('show');
}

/** Opens the 동작 팔레트 over the 매크로 tab in 진행. */
export function openPalette(
  onWorkspace: ((workspace: Workspace) => void) | undefined,
): void {
  useMacroPalette.getState().show();
  openTool('macro', onWorkspace);
}
