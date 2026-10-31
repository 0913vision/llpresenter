import {contentEndpoints} from '@contracts/ipc/content';
import {serviceEndpoints} from '@contracts/ipc/service';
import type {AppProblem} from '@core/schema/appProblem';
import {parseSongDocument} from '@core/schema/contentDocuments';
import {join} from 'node:path';
import {afterEach, beforeEach, vi} from 'vitest';
import {makeTempDir} from '../../../../test/temp-dir';
import type {Logger} from '../../log';
import {openAppConfig} from '../appConfigFile';
import {registerStore, type DataStore} from '../register';

/** A mock IPC handler signature without an Electron connection. */
export type Handler = (event: unknown, value: unknown) => unknown;

const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  listeners: new Map<string, () => void>(),
  paths: new Map<string, string>(),
  send: vi.fn(),
}));

/** Isolated hoisted Electron state, without a real window or IPC connection. */
export {electron};

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
  app: {
    getPath: (name: string) => electron.paths.get(name) ?? '',
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electron.handlers.delete(channel);
    },
    on: (channel: string, listener: () => void) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
}));

/** Orders problem fixtures by their names without changing them. */
export function byName(a: AppProblem, b: AppProblem): number {
  const name = (problem: AppProblem): string =>
    'name' in problem ? problem.name : '';
  return name(a).localeCompare(name(b));
}

/** Builds isolated mock problem callbacks without registering a feed. */
export function mockProblems() {
  return {report: vi.fn(), push: vi.fn(), addStanding: () => () => undefined};
}

/** Builds isolated mock logging callbacks without filesystem output. */
export function mockLog() {
  return {
    info: vi.fn<Logger['info']>(),
    warn: vi.fn<Logger['warn']>(),
    error: vi.fn<Logger['error']>(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

/** Temporary fixture locations, without directory creation. */
export interface TestFolders {
  readonly appDataFolder: string;
  readonly developmentFolder: string;
  readonly documents: string;
}

/** Creates the existing isolated temporary data context with test cleanup. */
export async function developmentContext(): Promise<TestFolders> {
  const folder = await makeTempDir();
  return {
    appDataFolder: folder,
    developmentFolder: folder,
    documents: join(folder, 'not-used-in-development'),
  };
}

/** Per-test store cleanup registrations, without shared application ownership. */
export const disposers: Array<() => Promise<void>> = [];

/**
 * Opens the existing registration integration fixture and records its disposer
 * for cleanup.
 */
export async function register(
  log: Logger,
  {appDataFolder, developmentFolder, documents}: TestFolders,
  isAnyOutputOn: () => boolean = () => false,
): Promise<DataStore> {
  electron.paths.set('userData', appDataFolder);
  const appConfig = await openAppConfig({
    file: join(appDataFolder, 'app.json'),
    log,
  });
  const store = registerStore({
    problems: mockProblems(),
    log,
    isAnyOutputOn,
    appConfig,
    context: () => ({developmentFolder, documents}),
  });
  disposers.push(store.dispose);
  return store;
}

/** Calls the mock service reader without an external IPC connection. */
export function askForService(): Promise<unknown> {
  return ask(serviceEndpoints.get.channel);
}

/** Calls an installed mock IPC handler without opening an Electron connection. */
export function ask(channel: string, value?: unknown): Promise<unknown> {
  const handler = electron.handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler: ${channel}`);
  return Promise.resolve(handler({}, value));
}

/** Reads a parsed grouped song from the existing mock IPC fixture. */
export async function songDocument(id: string) {
  const parsed = parseSongDocument(
    await ask(contentEndpoints.songs.get.channel, id),
  );
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Missing grouped fixture');
  }
  return parsed.value;
}

beforeEach(() => {
  electron.handlers.clear();
  electron.paths.clear();
  electron.send.mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(disposers.splice(0).map(async dispose => dispose()));
});
