import {createContext} from 'react';

/** The three workspaces of the control window. */
export type Workspace = 'show' | 'prep' | 'screens';

/** Lets nested tool menus open the workspace that owns an editor. */
export const WorkspaceNavigation = createContext<
  ((workspace: Workspace) => void) | undefined
>(undefined);
