import {
  parseSettingsEdit,
  type SettingsEdit,
} from '@core/schema/settingsDocuments';
import type {SettingsReader} from '@core/schema/settingsReader';
import type {EditResult} from '@core/schema/contentEdit';
import type {Logger} from './log';

/** The part of Electron's `app` that runs the Windows sign-in item. */
export interface LoginItems {
  getLoginItemSettings(): {readonly openAtLogin: boolean};
  setLoginItemSettings(settings: {readonly openAtLogin: boolean}): void;
}

/**
 * Whether a run may touch the Windows sign-in items: only a packaged build on
 * Windows. A run from source (`electron-vite dev`) and a check with the
 * offscreen windows are never packaged, so they never register one.
 */
export function loginItemsAllowed(
  isPackaged: boolean,
  platform: NodeJS.Platform,
): boolean {
  return isPackaged && platform === 'win32';
}

export interface LaunchAtLoginOptions {
  readonly settings: Promise<SettingsReader | null>;
  /** Applies a whole-file settings edit (`DataStore.applySettingsEdit`). */
  readonly applyEdit: (edit: SettingsEdit) => Promise<EditResult>;
  readonly loginItems: LoginItems;
  /** {@link loginItemsAllowed} for this run. */
  readonly enabled: boolean;
  readonly log: Logger;
}

/**
 * The 시작 row 환경설정 Windows 시작할 때 실행 (docs/spec/10). A change of
 * `general.launchAtLogin` is applied to the Windows sign-in item at once. At
 * launch Windows is the truth: when it reports another value than the file (the
 * item was changed outside the app), the file takes Windows' value, so the
 * checkbox shows what Windows reports. Never throws.
 *
 * @returns A function that stops following the settings.
 */
export function registerLaunchAtLogin({
  settings,
  applyEdit,
  loginItems,
  enabled,
  log,
}: LaunchAtLoginOptions): () => void {
  if (!enabled) return () => undefined;
  let stop: (() => void) | undefined;
  const state = {stopped: false};
  const isStopped = (): boolean => state.stopped;
  settings
    .then(async store => {
      if (store === null || isStopped()) return;
      let applied = store.preferences().general.launchAtLogin;
      const windows = readWindows(loginItems, log);
      if (windows !== undefined && windows !== applied) {
        await followWindows({store, applyEdit, openAtLogin: windows, log});
        applied = windows;
      }
      if (isStopped()) return;
      stop = store.subscribe(document => {
        if (document.name !== 'preferences') return;
        const wanted = store.preferences().general.launchAtLogin;
        if (wanted === applied) return;
        try {
          loginItems.setLoginItemSettings({openAtLogin: wanted});
          applied = wanted;
        } catch (error: unknown) {
          log.error('could not set the Windows sign-in item', error);
        }
      });
    })
    .catch((error: unknown) =>
      log.error('could not follow the Windows sign-in item', error),
    );
  return () => {
    state.stopped = true;
    stop?.();
  };
}

/** What Windows reports, or nothing when the read throws (logged). */
function readWindows(loginItems: LoginItems, log: Logger): boolean | undefined {
  try {
    return loginItems.getLoginItemSettings().openAtLogin;
  } catch (error: unknown) {
    log.error('could not read the Windows sign-in item', error);
    return undefined;
  }
}

async function followWindows({
  store,
  applyEdit,
  openAtLogin,
  log,
}: {
  readonly store: SettingsReader;
  readonly applyEdit: (edit: SettingsEdit) => Promise<EditResult>;
  readonly openAtLogin: boolean;
  readonly log: Logger;
}): Promise<void> {
  const document = store.get('preferences');
  if (document.name !== 'preferences' || document.access !== 'editable') return;
  const edit = parseSettingsEdit({
    type: 'settings.update',
    name: 'preferences',
    baseRevision: document.revision,
    value: {
      ...document.value,
      general: {...document.value.general, launchAtLogin: openAtLogin},
    },
  });
  if (!edit.ok) {
    log.warn('could not store the Windows sign-in item', edit.error);
    return;
  }
  const result = await applyEdit(edit.value);
  if (!result.ok) {
    log.warn('could not store the Windows sign-in item', result.error);
  }
}
