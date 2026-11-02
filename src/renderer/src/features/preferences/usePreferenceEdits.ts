import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';
import {
  withPreferenceDefaults,
  type Preferences,
  type PreferencesFile,
} from '@core/schema/preferences';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {noticeTime, type Notice} from '@renderer/ui/notices';

const TITLE = '환경설정';
const SAVE_FAILURE: Notice = {
  key: 'preferences:save',
  kind: 'warning',
  icon: 'warning',
  title: '환경설정을 저장하지 못함',
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

const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';

/**
 * Reads 환경설정 and follows its changes. A change is written against the
 * newest revision, one after another, through the window's close gate; a
 * refused or failed write shows the save failure notice and changes nothing.
 */
export function usePreferenceEdits(
  onProblem: (notice: Notice) => void,
): PreferenceEdits {
  const document = useSettingsDocument('preferences', TITLE, onProblem);
  const latest = useRef(document);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);
  useLayoutEffect(() => {
    if (
      document !== null &&
      document.revision >= (latest.current?.revision ?? 0)
    ) {
      latest.current = document;
    }
  }, [document]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const report = useCallback(() => {
    if (alive.current) onProblem({...SAVE_FAILURE, time: noticeTime()});
  }, [onProblem]);
  const change = useCallback(
    (next: PreferenceChange): void => {
      const api = window.llp;
      if (api === undefined) {
        report();
        return;
      }
      const write = async (): Promise<boolean> => {
        const base = latest.current;
        if (base?.access !== 'editable') {
          report();
          return false;
        }
        try {
          const value = next(base.value);
          const result = await api.settings.edit({
            type: 'settings.update',
            name: 'preferences',
            baseRevision: base.revision,
            value,
          });
          if (!result.ok) {
            report();
            return false;
          }
          const {revision} = result.value;
          if (revision !== null && revision > base.revision) {
            latest.current = {...base, revision, value};
          }
          return true;
        } catch (cause: unknown) {
          console.error('Could not save 환경설정:', cause);
          report();
          return false;
        }
      };
      const queued = chain.current.then(write, write);
      chain.current = queued;
      pendingWritesOf(api)
        .run({write: () => queued, refused: false, sent: sent => sent})
        .catch((cause: unknown) =>
          console.error('Could not register a 환경설정 write:', cause),
        );
    },
    [report],
  );
  return {
    preferences:
      document === null ? null : withPreferenceDefaults(document.value),
    lockedReason:
      document?.access === 'readOnly' ? NEWER_FILE_REASON : undefined,
    change,
  };
}
