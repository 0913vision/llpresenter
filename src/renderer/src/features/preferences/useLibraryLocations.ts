import {useCallback, useEffect, useRef, useState} from 'react';
import type {
  ChooseLocationFailure,
  LibraryLocationField,
  LocationsView,
} from '@core/schema/libraryLocations';
import {noticeTime, type Notice} from '@renderer/ui/notices';

const FOLDER_REFUSALS: Readonly<
  Record<Exclude<ChooseLocationFailure, 'canceled'>, string>
> = {
  'not-writable': '이 폴더에는 쓸 수 없음',
  'outside-development': '개발용 폴더 밖은 쓸 수 없음',
  'settings-locked': '새 버전의 파일이라 바꿀 수 없습니다',
};
const BACKUP_FAILED = '백업하지 못함';
const BACKUP_OUTPUT_ON = '출력 중에는 백업하지 않음';

function warning(key: string, title: string): Notice {
  return {key, kind: 'warning', icon: 'warning', title, time: noticeTime()};
}

export interface LibraryLocationsState {
  /** The folders and backup state; null until the first read. */
  readonly view: LocationsView | null;
  readonly choose: (field: LibraryLocationField) => void;
  readonly backUpNow: () => void;
}

/**
 * Reads the 라이브러리 folders and the last backup, follows their changes,
 * and answers 바꾸기 and 지금 백업. A refused folder or a failed backup shows
 * a warning notice.
 */
export function useLibraryLocations(
  onProblem: (notice: Notice) => void,
): LibraryLocationsState {
  const [view, setView] = useState<LocationsView | null>(null);
  const report = useRef(onProblem);
  useEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let alive = true;
    const accept = (next: LocationsView): void => {
      if (alive) setView(next);
    };
    const stop = api.locations.subscribe(accept);
    api.locations.get().then(accept, (error: unknown) => {
      console.error('Could not read the library folders', error);
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  const choose = useCallback((field: LibraryLocationField) => {
    window.llp?.locations
      .choose({field})
      .then(result => {
        if (result.ok || result.error.reason === 'canceled') return;
        const title = FOLDER_REFUSALS[result.error.reason];
        report.current(warning(`preferences:folder:${field}`, title));
      })
      .catch((error: unknown) => {
        console.error('Could not change the folder', error);
        report.current(
          warning(
            `preferences:folder:${field}`,
            FOLDER_REFUSALS['not-writable'],
          ),
        );
      });
  }, []);
  const backUpNow = useCallback(() => {
    window.llp?.locations
      .backUpNow()
      .then(result => {
        if (result.ok) return;
        const title =
          result.error.reason === 'output-on'
            ? BACKUP_OUTPUT_ON
            : BACKUP_FAILED;
        report.current(warning('preferences:backup', title));
      })
      .catch((error: unknown) => {
        console.error('Could not back up', error);
        report.current(warning('preferences:backup', BACKUP_FAILED));
      });
  }, []);
  return {view, choose, backUpNow};
}
