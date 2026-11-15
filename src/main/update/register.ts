import {ipcMain, type IpcMainEvent, type IpcMainInvokeEvent} from 'electron';
import {updateEndpoints} from '@contracts/ipc/update';
import {parseUpdateAction} from '@core/schema/update';
import {isAnyOutputOn} from '@core/live/state';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import type {ShutdownCoordinator} from '../shutdown';
import {UpdateController} from './controller';
import {createUpdater} from './electronUpdater';

interface RegisterOptions {
  readonly control: {
    readonly webContents: {
      readonly mainFrame: object;
      isDestroyed(): boolean;
      send(channel: string, value: unknown): void;
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
    changed: snapshot => {
      try {
        if (!control.webContents.isDestroyed()) {
          control.webContents.send(updateEndpoints.changed.channel, snapshot);
        }
      } catch (error) {
        log.warn('Could not send update state', error);
      }
    },
    installAfterShutdown: async (install, version) => {
      let cancelled = false;
      const isCancelled = (): boolean => cancelled;
      const accepted = await options.shutdown.quitForUpdate(
        install,
        () => true,
        {
          savePending: async () => {
            if (!(await options.savePending()) || isCancelled()) return false;
            const prepared = await options.prepareRestart(version);
            if (isCancelled()) {
              await options.cancelRestart();
              return false;
            }
            return prepared;
          },
          verifyClean: options.verifyClean,
        },
      );
      if (!accepted) {
        cancelled = true;
        await options.cancelRestart();
        options.resumeAfterCancelledInstall();
      }
      return accepted;
    },
  });
  const trusted = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.sender === control.webContents &&
    event.senderFrame === control.webContents.mainFrame;
  ipcMain.handle(updateEndpoints.get.channel, (event, ...args: unknown[]) => {
    if (!trusted(event) || args.length !== 0) {
      throw new Error('Invalid update query');
    }
    return controller.get();
  });
  const check = (event: IpcMainEvent, ...args: unknown[]): void => {
    if (!trusted(event) || args.length !== 0) {
      log.warn('Refused an invalid update check');
      return;
    }
    controller
      .check()
      .catch((error: unknown) =>
        log.warn('Could not check for updates', error),
      );
  };
  const act = (event: IpcMainEvent, ...args: unknown[]): void => {
    const parsed = parseUpdateAction(args[0]);
    if (!trusted(event) || args.length !== 1 || !parsed.ok) {
      log.warn('Refused an invalid update action');
      return;
    }
    controller.act(parsed.value);
  };
  ipcMain.on(updateEndpoints.check.channel, check);
  ipcMain.on(updateEndpoints.act.channel, act);
  const unsubscribe = store.subscribe(() => controller.outputsChanged());
  options.ready
    .then(ready => {
      if (ready) controller.launch();
    })
    .catch((error: unknown) => log.warn('Could not defer update check', error));
  return () => {
    controller.dispose();
    unsubscribe();
    ipcMain.removeHandler(updateEndpoints.get.channel);
    ipcMain.removeListener(updateEndpoints.check.channel, check);
    ipcMain.removeListener(updateEndpoints.act.channel, act);
  };
}
