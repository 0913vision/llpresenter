import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';
import type {Logger} from '../log';
import type {SettingsListener, SettingsReader} from './settingsStore';

/** Main-only settings reads and change subscriptions. */
export interface SettingsAccess {
  readonly readSettings: (
    name: SettingsName,
  ) => Promise<SettingsDocument | null>;
  readonly subscribeSettingsChanges: (listener: SettingsListener) => () => void;
}

/** Waits for launch loading and releases both pending and active subscriptions on close. */
export function createSettingsAccess(
  loading: Promise<SettingsReader | null>,
  log: Logger,
): SettingsAccess & {dispose(): void} {
  let disposed = false;
  const subscriptions = new Set<() => void>();
  const ready = loading.catch((error: unknown) => {
    log.error('could not open main-side settings access', error);
    return null;
  });
  return {
    readSettings: async name => {
      const store = await ready;
      if (disposed || store === null) return null;
      try {
        return store.get(name);
      } catch (error: unknown) {
        log.error('could not read a settings area', {name, error});
        return null;
      }
    },
    subscribeSettingsChanges: listener => {
      if (disposed) return () => undefined;
      let stopped = false;
      let unsubscribe: (() => void) | undefined;
      const stop = () => {
        stopped = true;
        unsubscribe?.();
        subscriptions.delete(stop);
      };
      subscriptions.add(stop);
      ready
        .then(store => {
          if (disposed || stopped || store === null) {
            stop();
            return;
          }
          unsubscribe = store.subscribe(document => {
            if (!disposed && !stopped) listener(document);
          });
        })
        .catch((error: unknown) => {
          log.error('could not subscribe to main-side settings changes', error);
          stop();
        });
      return stop;
    },
    dispose: () => {
      disposed = true;
      for (const stop of subscriptions) stop();
    },
  };
}
