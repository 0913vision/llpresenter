import type {
  SettingsDocument,
  SettingsName,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {parseLookId, type LookId} from '@shared/schema/ids';
import type {EditRefusalReason, EditResult} from '@shared/schema/contentEdit';
import type {Logger} from '../log';
import type {SettingsListener, SettingsReader} from './settingsStore';

type LookSettingsReader = SettingsReader & {
  readonly apply?: (edit: SettingsEdit) => Promise<EditResult>;
};

function refuse(reason: EditRefusalReason, message: string): EditResult {
  return {ok: false, error: {reason, message}};
}

function selectSavedLook(
  store: LookSettingsReader,
  lookId: LookId,
): Promise<EditResult> {
  const current = store.get('looks');
  if (
    current.name !== 'looks' ||
    !current.value.looks.some(look => look.id === lookId)
  ) {
    return Promise.resolve(
      refuse('not-found', 'The selected Look is unavailable'),
    );
  }
  if (current.access === 'readOnly') {
    return Promise.resolve(
      refuse('read-only', 'The Look settings are read-only'),
    );
  }
  if (current.value.current === lookId) {
    return Promise.resolve({
      ok: true,
      value: {id: 'looks', revision: current.revision},
    });
  }
  if (store.apply === undefined) {
    return Promise.resolve(
      refuse('not-found', 'Look settings cannot be saved'),
    );
  }
  return store.apply({
    type: 'settings.update',
    name: 'looks',
    value: {...current.value, current: lookId},
    baseRevision: current.revision,
  });
}

/** Main-only settings reads, change subscriptions and saved Look selection. */
export interface SettingsAccess {
  /** Validates a UUID and saves only looks.current through the existing revisioned writer. */
  readonly selectLook: (lookId: unknown) => Promise<EditResult>;
  readonly readSettings: (
    name: SettingsName,
  ) => Promise<SettingsDocument | null>;
  readonly subscribeSettingsChanges: (listener: SettingsListener) => () => void;
}

/** Waits for launch loading and releases both pending and active subscriptions on close. */
export function createSettingsAccess(
  loading: Promise<LookSettingsReader | null>,
  log: Logger,
): SettingsAccess & {dispose(): void} {
  let disposed = false;
  const subscriptions = new Set<() => void>();
  const ready = loading.catch((error: unknown) => {
    log.error('could not open main-side settings access', error);
    return null;
  });
  return {
    selectLook: async value => {
      const id = parseLookId(value);
      if (!id.ok) return refuse('invalid', id.error.message);
      const store = await ready;
      if (disposed || store === null) {
        return refuse('not-found', 'Look settings are unavailable');
      }
      try {
        return await selectSavedLook(store, id.value);
      } catch (error) {
        log.error('could not select a Look', error);
        return refuse('invalid', 'The Look selection failed');
      }
    },
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
