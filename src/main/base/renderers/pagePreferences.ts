import type {WebPreferences} from 'electron';
import {join} from 'node:path';

/** The built preload script that gives the app's pages its API. */
const preloadPath = join(__dirname, '../preload/index.js');

/**
 * The web preferences every window starts from: a sandboxed page with
 * context isolation and no Node.js.
 */
export const SANDBOXED_PAGE = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
} as const satisfies WebPreferences;

/**
 * The web preferences of a window that shows one of the app's pages: a
 * sandboxed page that reaches the app only through the preload's API.
 */
export const APP_PAGE = {
  preload: preloadPath,
  ...SANDBOXED_PAGE,
} as const satisfies WebPreferences;
