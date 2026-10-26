import type {SettingsReader} from '../store/settingsStore';
import type {Logger} from '../log';
import {dispatchLogged, type LiveStore} from './store';
import {followMessageExpiry} from './messageExpiry';
import {overlayRefreshCommands, stageRefreshCommands} from './overlayRefresh';
import {followTimerCompletion} from './timerCompletion';

interface OverlayOptions {
  readonly store: LiveStore;
  readonly settings: Promise<SettingsReader | null>;
  readonly log: Logger;
  readonly now?: () => number;
}

/** Owns expiry and settings subscriptions, including late startup cleanup. */
export function startOverlays({
  store,
  settings,
  log,
  now = Date.now,
}: OverlayOptions): () => void {
  let disposed = false;
  let stopSettings: (() => void) | null = null;
  let releaseSettings: (() => void) | null = null;
  let completion: ReturnType<typeof followTimerCompletion> | null = null;
  const stopExpiry = followMessageExpiry({
    store,
    now,
    send: command => dispatchLogged(store, command, log),
  });
  void settings
    .then(reader => {
      if (disposed || reader === null) return;
      // NOTE(0913vision): This lifecycle alone owns the store's reader.
      // Output subscriptions use it without attaching a second owner.
      releaseSettings = store.connectSettings(reader);
      completion = followTimerCompletion({
        store,
        settings: reader,
        now: () => ({wall: now(), timer: store.timerNow()}),
        send: command => dispatchLogged(store, command, log),
        onError: error =>
          log.error('could not complete countdown timers', error),
      });
      stopSettings = reader.subscribe(document => {
        if (disposed) return;
        if (document.name === 'timers') completion?.refresh();
        const commands = [
          ...overlayRefreshCommands(store.state, document),
          ...stageRefreshCommands(store.state, document),
        ];
        if (commands.length > 0) {
          dispatchLogged(store, {type: 'live.batch', commands}, log);
        }
      });
    })
    .catch((error: unknown) =>
      log.error('could not connect overlay settings', error),
    );
  return () => {
    if (disposed) return;
    disposed = true;
    stopExpiry();
    completion?.dispose();
    stopSettings?.();
    releaseSettings?.();
  };
}
