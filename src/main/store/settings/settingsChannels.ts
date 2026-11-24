import {settingsEndpoints} from '@contracts/ipc/settings';
import type {EditResult} from '@core/schema/contentEdit';
import {defaultPreferences} from '@core/schema/preferences';
import type {LabelRename} from '@core/schema/settingsDocuments';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import {LabelColorPreviews} from './labelColorPreviews';
import type {SettingsProblemListener, SettingsStore} from './settingsStore';

/** The parts of the settings store that the channels use. */
type ChannelStore = Pick<
  SettingsStore,
  | 'subscribe'
  | 'subscribeProblems'
  | 'preferences'
  | 'get'
  | 'apply'
  | 'dispose'
>;

export interface SettingsChannels {
  readonly subscribe: (listener: SettingsProblemListener) => () => void;
  /** Stops answering, and waits until the store has saved what it took. */
  readonly dispose: () => Promise<void>;
}

const UNAVAILABLE: EditResult = {
  ok: false,
  error: {reason: 'not-found', message: 'Settings are unavailable'},
};

/** Renames labels one after another. */
class LabelRenames {
  private last: Promise<void> = Promise.resolve();

  constructor(
    private readonly rename: (edit: LabelRename) => Promise<EditResult>,
    private readonly log: Logger,
  ) {}

  /** Settles once every accepted rename has ended. */
  ended(): Promise<void> {
    return this.last;
  }

  apply(edit: LabelRename): Promise<EditResult> {
    const result = this.last
      .then(() => this.rename(edit))
      .catch((error: unknown): EditResult => {
        this.log.error('could not rename a label', error);
        return {
          ok: false,
          error: {reason: 'invalid', message: 'Could not rename the label'},
        };
      });
    this.last = result.then(() => undefined);
    return result;
  }
}

/** Answers the reads and edits of the settings, and follows their problems. */
export function registerSettingsChannels(
  loading: Promise<ChannelStore | null>,
  log: Logger,
  renameLabel: (edit: LabelRename) => Promise<EditResult> = () =>
    Promise.resolve(UNAVAILABLE),
): SettingsChannels {
  const ipc = new IpcHost(log);
  const previews = new LabelColorPreviews(ipc);
  const renames = new LabelRenames(renameLabel, log);
  let disposed = false;
  let closing: Promise<void> | null = null;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open settings channels', error);
    return null;
  });
  const open = async (): Promise<ChannelStore | null> => {
    const store = await ready;
    return disposed ? null : store;
  };
  const following = open().then(store => {
    if (store === null) return;
    ipc.whenClosed(
      store.subscribe(document => {
        if (document.name === 'labels') previews.clear();
        ipc.push(settingsEndpoints.changed, document);
        if (document.name === 'preferences') {
          ipc.push(settingsEndpoints.preferencesChanged, store.preferences());
        }
      }),
    );
  });
  ipc.query(
    settingsEndpoints.preferences,
    async () => (await ready)?.preferences() ?? defaultPreferences,
  );
  ipc.request(settingsEndpoints.get, async ({name}) => {
    const store = await open();
    if (store === null) throw new Error('Settings unavailable');
    return store.get(name);
  });
  ipc.request(settingsEndpoints.edit, async edit => {
    const store = await open();
    if (store === null) return UNAVAILABLE;
    return edit.type === 'labels.rename'
      ? renames.apply(edit)
      : store.apply(edit);
  });
  ipc.request(
    settingsEndpoints.previewLabelColor,
    async (request, {contents}) => {
      const store = await open();
      return store !== null && previews.change(request, contents, store);
    },
  );
  ipc.whenClosed(previews.clear);
  const close = async (): Promise<void> => {
    await following;
    await renames.ended();
    await (await ready)?.dispose();
  };
  return {
    subscribe: listener => {
      let removed = false;
      let unsubscribe: (() => void) | undefined;
      const active = (): boolean => !removed && !disposed;
      ready
        .then(store => {
          if (!active() || store === null) return;
          const stop = store.subscribeProblems(listener);
          if (!active()) stop();
          else unsubscribe = stop;
        })
        .catch((error: unknown) =>
          log.error('could not subscribe to settings problems', error),
        );
      return () => {
        removed = true;
        unsubscribe?.();
      };
    },
    dispose: () => {
      if (closing !== null) return closing;
      disposed = true;
      ipc.close();
      closing = close();
      return closing;
    },
  };
}
