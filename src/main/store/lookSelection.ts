import type {SettingsReader} from '@core/schema/settingsReader';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {parseLookId, type LookId} from '@core/schema/ids';
import type {EditRefusalReason, EditResult} from '@core/schema/contentEdit';
import type {Logger} from '../log';

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

/** The required main-process writer for saved Look selection. */
export interface LookSelectionPort {
  /**
   * Validates the UUID and saves only looks.current. Settles after the debounced
   * write; set LiveState.lookId before awaiting it so output changes immediately.
   */
  readonly selectLook: (lookId: unknown) => Promise<EditResult>;
}

/** Releases pending selections on close without changing the settings reader. */
export function createLookSelection(
  loading: Promise<LookSettingsReader | null>,
  log: Logger,
): LookSelectionPort & {dispose(): void} {
  let disposed = false;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open Look selection', error);
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
    dispose: () => {
      disposed = true;
    },
  };
}
