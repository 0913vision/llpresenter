import {useCallback, useEffect, useRef, useState} from 'react';
import {
  mediaImportFailureNotice,
  requestMediaImport,
} from '@renderer/features/media/mediaImport';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {menuAvailability, type MenuItem} from '@renderer/ui/menuModel';
import type {Notice} from '@renderer/ui/notices';

/**
 * How many failed media ids are remembered to report each failure once. The
 * push and the reply of one import arrive together, so a short history is
 * enough, and the oldest id is forgotten first.
 */
export const REPORTED_FAILURES_LIMIT = 64;

export function useFileMediaImport(
  onProblem: (notice: Notice) => void,
): MenuItem {
  const pending = useRef(false);
  const alive = useRef(true);
  const report = useRef(onProblem);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    report.current = onProblem;
  }, [onProblem]);
  const reported = useRef(new Set<string>());
  const reportFailure = useCallback((progress: MediaImportProgress): void => {
    if (!alive.current || reported.current.has(progress.mediaId)) return;
    const failure = mediaImportFailureNotice(progress);
    if (!failure) return;
    reported.current.add(progress.mediaId);
    if (reported.current.size > REPORTED_FAILURES_LIMIT) {
      const oldest = reported.current.values().next();
      if (!oldest.done) reported.current.delete(oldest.value);
    }
    report.current(failure);
  }, []);
  useEffect(() => {
    alive.current = true;
    const stop = window.llp?.media.subscribeImports(reportFailure);
    return () => {
      alive.current = false;
      stop?.();
    };
  }, [reportFailure]);
  const start = (): void => {
    const api = window.llp;
    if (!api || pending.current) return;
    pending.current = true;
    setBusy(true);
    requestMediaImport({
      api,
      source: {kind: 'dialog'},
      playlist: null,
      onProblem: notice => {
        if (alive.current) report.current(notice);
      },
    })
      .then(jobs => {
        for (const progress of jobs ?? []) reportFailure(progress);
      })
      .catch((cause: unknown) => {
        console.error('File menu media import failed:', cause);
      })
      .finally(() => {
        pending.current = false;
        if (alive.current) setBusy(false);
      });
  };
  return {
    kind: 'item',
    id: 'import-media',
    label: '미디어…',
    ...menuAvailability(
      window.llp === undefined
        ? '미디어 가져오기 연결 안 됨'
        : busy
          ? '미디어를 가져오는 중'
          : undefined,
    ),
    onSelect: start,
  };
}
