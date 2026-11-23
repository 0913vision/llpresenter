import {updateEndpoints} from '@contracts/ipc/update';
import {isAnyOutputOn} from '@core/schema/live';
import type {LiveStore} from '../live/store';
import {IpcHost, pushToWindow, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {ShutdownCoordinator} from '../base/shutdown';
import {UpdateController} from './controller';
import {createUpdater} from './electronUpdater';

interface RegisterOptions {
  readonly control: {
    readonly webContents: {
      readonly mainFrame: object;
      isDestroyed(): boolean;
      send(channel: string, value: unknown): void;
      executeJavaScript?(code: string): Promise<unknown>;
    };
  };
  readonly store: Pick<LiveStore, 'state' | 'subscribe'>;
  readonly log: Logger;
  readonly shutdown: Pick<ShutdownCoordinator, 'quitForUpdate'>;
  readonly ready: Promise<boolean>;
  readonly enabled: boolean;
  readonly version: string;
  readonly verifyClean: () => Promise<boolean>;
  readonly savePending: () => Promise<boolean>;
  readonly resumeAfterCancelledInstall: () => void;
  readonly prepareRestart: (version: string) => Promise<boolean>;
  readonly cancelRestart: () => Promise<void>;
}

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
    installAfterShutdown: async (install, version, onHandoff) => {
      let cancelled = false;
      const isCancelled = (): boolean => cancelled;
      let accepted = false;
      try {
        accepted = await options.shutdown.quitForUpdate(install, () => true, {
          savePending: async () => {
            if (!(await options.savePending()) || isCancelled()) return false;
            const prepared = await options.prepareRestart(version);
            if (isCancelled()) {
              await options.cancelRestart();
              return false;
            }
            return prepared;
          },
          beforeShutdown: async () => {
            onHandoff();
            if (control.webContents.isDestroyed()) return;
            await Promise.race([
              control.webContents.executeJavaScript?.(
                'new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); setTimeout(resolve, 250); })',
              ),
              new Promise<void>(resolve => setTimeout(resolve, 500)),
            ]);
          },
          verifyClean: options.verifyClean,
        });
        return accepted;
      } finally {
        if (!accepted) {
          cancelled = true;
          await options.cancelRestart();
          options.resumeAfterCancelledInstall();
        }
      }
    },
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
      log.warn('Refused an update check of another window');
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
    else log.warn('Refused an update action of another window');
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
