import {create} from 'zustand';
import type {ShowTool} from '@renderer/features/tools/showTools';
import type {UiState} from '@core/schema/uiState';

interface ShowToolTab {
  readonly tool: ShowTool;
  readonly setTool: (tool: ShowTool) => void;
}

/** The chosen 진행 도구 tab, kept for the session across workspaces and size classes. */
export const useShowToolTab = create<ShowToolTab>(set => ({
  tool: 'stage',
  setTool: tool => {
    set({tool});
    window.llp?.ui.setRememberedView({showToolTab: tool});
  },
}));
export function seedShowToolTab(state: UiState): void {
  useShowToolTab.setState({tool: state.showToolTab ?? 'stage'});
}
