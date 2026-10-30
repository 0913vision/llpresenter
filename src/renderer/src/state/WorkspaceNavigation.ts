import {createContext} from 'react';
import type {Workspace} from '@renderer/shell/Toolbar';

/** Lets nested tool menus open the workspace that owns an editor. */
export const WorkspaceNavigation = createContext<
  ((workspace: Workspace) => void) | undefined
>(undefined);
