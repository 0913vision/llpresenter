import {updateEndpoints} from '@contracts/ipc/update';
import {isAnyOutputOn} from '@core/schema/live/live';
import type {LiveStore} from '../live/store';
import {IpcHost, pushToWindow, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {UpdateController} from './controller';
import {createUpdater} from './electronUpdater';
import {
  handOverToInstaller,
  type InstallHandoffOptions,
} from './installHandoff';
import {contentsForLog} from '../base/renderers/pageUrl';

interface RegisterOptions extends InstallHandoffOptions {
  readonly control: {
    readonly webContents: InstallHandoffOptions['control']['webContents'] & {
      readonly mainFrame: object;
      send(channel: string, value: unknown): void;
    };
  };
  readonly store: Pick<LiveStore, 'state' | 'subscribe'>;
  readonly log: Logger;
  readonly ready: Promise<boolean>;
  readonly enabled: boolean;
  readonly version: string;
}

/**
 * Whether the app may check for updates: only a packaged build on Windows
 * outside test mode.
 */
export function updatesAllowed(options: {
  readonly packaged: boolean;
  readonly platform: string;
  readonly testing: boolean;
}): boolean {
  return options.packaged && options.platform === 'win32' && !options.testing;
}

/** Registers the control-only IPC boundary and defers the launch check. */
export function registerUpdates(options: RegisterOptions): () => void {
  const {control, log, store} = options;
  const outputsOn = (): boolean => isAnyOutputOn(store.state);
  const controller = new UpdateController({
    updater: options.enabled ? createUpdater(log) : null,
    version: options.version,
    outputsOn,
    log,
    changed: value => {
      pushToWindow(control.webContents, updateEndpoints.changed, {value, log});
    },
    installAfterShutdown: (install, version, onHandoff) =>
      handOverToInstaller(options, {install, version, onHandoff}),
  });
  const ipc = new IpcHost(log);
  const isControl = ({contents, isMainFrame}: Caller): boolean =>
    contents === control.webContents && isMainFrame;
  ipc.query(updateEndpoints.get, caller => {
    if (!isControl(caller)) {
      throw new Error('Only the control window may ask about updates');
    }
    return controller.get();
  });
  ipc.signal(updateEndpoints.check, caller => {
    if (!isControl(caller)) {
      log.warn(
        'Refused an update check of another window',
        contentsForLog(caller.contents),
      );
      return;
    }
    controller
      .check()
      .catch((error: unknown) =>
        log.warn('Could not check for updates', error),
      );
  });
  ipc.message(updateEndpoints.act, (action, caller) => {
    if (isControl(caller)) controller.act(action);
    else {
      log.warn(
        'Refused an update action of another window',
        contentsForLog(caller.contents),
      );
    }
  });
  const unsubscribe = store.subscribe(() => controller.outputsChanged());
  options.ready
    .then(ready => {
      if (ready) controller.launch();
    })
    .catch((error: unknown) => log.warn('Could not defer update check', error));
  return () => {
    controller.dispose();
    unsubscribe();
    ipc.close();
  };
}
