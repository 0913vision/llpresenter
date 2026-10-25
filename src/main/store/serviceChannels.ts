import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {ShowService} from '@shared/schema/showService';
import {parseServiceOpenRequest} from '@shared/schema/serviceOpen';
import type {Logger} from '../log';
import type {AppConfigFile} from './appConfigFile';
import type {ContentStore} from './contentStore';
import type {OpenServiceFeed} from './openServiceFeed';

export interface ServiceSession {
  readonly content: Pick<ContentStore, 'openService'>;
  readonly feed: Pick<OpenServiceFeed, 'current' | 'refresh'>;
}

export const MAX_PENDING_SERVICE_SWITCHES = 16;

/** Owns service reads and serialized switches, including accepted switches during shutdown. */
export function registerServiceChannels(
  loading: Promise<ServiceSession | null>,
  appConfig: Pick<AppConfigFile, 'setLastServiceId' | 'flush'>,
  log: Logger,
) {
  let disposed = false;
  let switching: Promise<void> = Promise.resolve();
  let closing: Promise<void> | null = null;
  let pendingSwitches = 0;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open service channels', error);
    return null;
  });
  ipcMain.handle(Channels.serviceGet, async () => {
    const opened = await ready;
    if (disposed || opened === null) return null;
    await opened.feed.refresh();
    return opened.feed.current();
  });
  ipcMain.handle(
    Channels.serviceOpen,
    async (_event, value: unknown): Promise<ShowService | null> => {
      const request = parseServiceOpenRequest(value);
      if (!request.ok) {
        log.warn('dropped a malformed service open request', request.error);
        return null;
      }
      const opened = await ready;
      if (disposed || opened === null) return null;
      if (pendingSwitches >= MAX_PENDING_SERVICE_SWITCHES) {
        log.warn('too many pending service switches');
        return null;
      }
      pendingSwitches++;
      const result = switching
        .then(async (): Promise<ShowService | null> => {
          const changed = await opened.content.openService(
            request.value.serviceId,
            () => opened.feed.refresh(),
          );
          if (!changed.ok) {
            log.warn('could not open a service', changed.error);
            return null;
          }
          try {
            appConfig.setLastServiceId(request.value.serviceId);
            await appConfig.flush();
          } catch (error: unknown) {
            log.error('could not remember the open service', error);
          }
          await opened.feed.refresh();
          return opened.feed.current();
        })
        .catch((error: unknown) => {
          log.error('could not open a service', error);
          return null;
        })
        .finally(() => {
          pendingSwitches--;
        });
      switching = result.then(() => undefined);
      return result;
    },
  );
  return {
    dispose: (): Promise<void> => {
      disposed = true;
      ipcMain.removeHandler(Channels.serviceGet);
      ipcMain.removeHandler(Channels.serviceOpen);
      closing ??= switching;
      return closing;
    },
  };
}
