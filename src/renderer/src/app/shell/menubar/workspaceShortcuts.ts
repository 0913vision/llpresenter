import {commandBindingStore} from '@renderer/ui/keys/commandBindings';
import {commandBindings, matchesBinding} from '@core/shortcuts';
import {SHOW_TOOLS} from '@renderer/features/tools/showTools';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';
import type {WindowShortcut} from '@renderer/ui/keys/commandDispatcher';
import {openPalette, openTool, TOOL_COMMANDS} from './showToolCommands';

/** What the workspace shortcuts do, and what decides the 진행 key. */
interface WorkspaceActions {
  readonly onWorkspace: (workspace: Workspace) => void;
  readonly onMedia: () => void;
  readonly imported: boolean;
  readonly editingSong?: boolean;
}

/** Decided ProPresenter workspace defaults, with imported-save precedence. */
export function workspaceShortcuts({
  onWorkspace,
  onMedia,
  imported,
  editingSong = false,
}: WorkspaceActions): readonly WindowShortcut[] {
  return [
    {
      id: 'workspace.show',
      when: event =>
        (!imported && !editingSong) ||
        !commandBindings(
          imported ? 'import.save' : 'songWindow.save',
          commandBindingStore.get(),
        ).some(binding => matchesBinding(event, binding)),
      run: () => onWorkspace('show'),
    },
    {id: 'workspace.prep', run: () => onWorkspace('prep')},
    {id: 'workspace.screens', run: () => window.llp?.window.openScreens()},
    {id: 'app.preferences', run: () => window.llp?.window.openPreferences()},
    ...SHOW_TOOLS.map(tool => ({
      id: TOOL_COMMANDS[tool.value],
      run: () => openTool(tool.value, onWorkspace),
    })),
    {id: 'tools.actionPalette', run: () => openPalette(onWorkspace)},
    {
      id: 'workspace.media',
      run: onMedia,
    },
  ];
}
