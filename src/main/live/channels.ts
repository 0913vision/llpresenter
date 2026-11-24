import {liveEndpoints} from '@contracts/ipc/live';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {startMediaProgress} from './media/mediaProgress';
import {dispatchLogged, type LiveStore} from './store';
import {startWallClockWatcher, wallClockSample} from './wallClock';

/**
 * Answers the windows about the live output, takes their commands, and sends
 * them every change.
 *
 * @returns A function that stops all of it.
 */
export function registerLiveChannels(
  store: Pick<
    LiveStore,
    | 'state'
    | 'timerNow'
    | 'mediaProgress'
    | 'handles'
    | 'dispatch'
    | 'subscribe'
  >,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  ipc.query(liveEndpoints.get, () => store.state);
  ipc.query(liveEndpoints.clock, () => store.timerNow());
  ipc.query(liveEndpoints.wallClock, () => wallClockSample());
  ipc.query(liveEndpoints.mediaProgress, () => store.mediaProgress());
  ipc.partialMessage(liveEndpoints.command, command => {
    log.debug?.('live command', command.type);
    dispatchLogged(store, command, log);
  });
  ipc.whenClosed(
    startWallClockWatcher(value =>
      ipc.push(liveEndpoints.wallClockChanged, value),
    ),
  );
  ipc.whenClosed(
    store.subscribe(state => ipc.push(liveEndpoints.changed, state)),
  );
  ipc.whenClosed(
    startMediaProgress(
      store,
      value => ipc.push(liveEndpoints.mediaProgressChanged, value),
      log,
    ),
  );
  return () => ipc.close();
}
