import type {BrowserWindow} from 'electron';
import {createElectronDisplaySource} from '../displays/electronSource';
import {DisplayRegistry} from '../displays/registry';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import {createDefaultScreenSource} from './defaultScreens';
import {createElectronOutputWindow} from './electronWindow';
import {OutputManager} from './manager';

/** What the output windows hang on. */
export interface OutputContext {
  readonly store: LiveStore;
  readonly control: BrowserWindow;
  readonly log: Logger;
}

/**
 * Starts watching the monitors and the output switches, and opens the output
 * windows as outputs turn on. Call it after the app is ready.
 *
 * @returns A function that closes every output window and stops watching.
 * Calling it again does nothing.
 */
export function startOutputs({store, control, log}: OutputContext): () => void {
  const displays = new DisplayRegistry(createElectronDisplaySource(), log);
  const outputs = new OutputManager({
    store,
    displays,
    screens: createDefaultScreenSource(displays),
    controlBounds: () => (control.isDestroyed() ? null : control.getBounds()),
    createHandle: (screen, events) =>
      createElectronOutputWindow(screen, events, log),
    log,
  });
  outputs.start();
  return () => {
    outputs.dispose();
    displays.dispose();
  };
}
