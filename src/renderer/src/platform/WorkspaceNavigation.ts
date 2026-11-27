import {createContext} from 'react';

/**
 * The four workspaces of the control window, one per toolbar tab. Each is
 * built once and kept: a switch only hides one and shows another (USER Nov 21,
 * Nov 27).
 */
export type Workspace = 'show' | 'prep' | 'library' | 'screens';

/** Lets nested tool menus open the workspace that owns an editor. */
export const WorkspaceNavigation = createContext<
  ((workspace: Workspace) => void) | undefined
>(undefined);

/** Opens a service item in 준비 through the control window's editor guard. */
export const PrepItemNavigation = createContext<
  ((itemId: string) => void) | undefined
>(undefined);
