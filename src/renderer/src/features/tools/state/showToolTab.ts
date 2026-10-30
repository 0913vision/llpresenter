import {create} from 'zustand';
import type {ShowTool} from '@renderer/features/tools/showTools';

interface ShowToolTab {
  readonly tool: ShowTool;
  readonly setTool: (tool: ShowTool) => void;
}

// TODO(0913vision): Remember the last tab in app.json, as spec 10 "Remembered
// state" asks, once the UI state has a field for it.
/** The chosen 진행 도구 tab, kept for the session across workspaces and size classes. */
export const useShowToolTab = create<ShowToolTab>(set => ({
  tool: 'stage',
  setTool: tool => set({tool}),
}));
