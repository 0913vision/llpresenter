import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  withPreferenceDefaults,
  type Preferences,
  type PreferencesFile,
} from '@core/schema/preferences';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {Notice} from '@renderer/ui/notices';
import {useQueuedWrites} from './useQueuedWrites';

const TITLE = '환경설정';
export {NEWER_FILE_REASON};
const SAVE_FAILURE: Notice = {
  key: 'preferences:save',
  kind: 'warning',
  icon: 'warning',
  title: '환경설정 저장 실패',
  time: '',
};

/** Changes the stored preferences file; the answer is the whole new file. */
export type PreferenceChange = (stored: PreferencesFile) => PreferencesFile;

export interface PreferenceEdits {
  /** Every preference with its default filled in; null until the first read. */
  readonly preferences: Preferences | null;
  /** Why nothing can change, such as a file of a newer version. */
  readonly lockedReason: string | undefined;
  /** Saves one change at once, after the changes before it. */
  readonly change: (change: PreferenceChange) => void;
}

/**
 * Reads 환경설정 and follows its changes. A change is written against the
 * newest revision, one after another, through the window's close gate; a
 * refused or failed write shows the save failure notice and changes nothing.
 */
export function usePreferenceEdits(
  onProblem: (notice: Notice) => void,
): PreferenceEdits {
  const document = useSettingsDocument('preferences', TITLE, onProblem);
  const change = useQueuedWrites({
    document,
    send: (base, value) =>
      window.llp === undefined
        ? Promise.reject(new Error('The window has no api'))
        : window.llp.settings.edit({
            type: 'settings.update',
            name: 'preferences',
            baseRevision: base.revision,
            value,
          }),
    failure: SAVE_FAILURE,
    onProblem,
  });
  return {
    preferences:
      document === null ? null : withPreferenceDefaults(document.value),
    lockedReason:
      document?.access === 'readOnly' ? NEWER_FILE_REASON : undefined,
    change,
  };
}
