import {useCallback, useEffect, useRef, useState} from 'react';
import {
  mediaImportFailureNotice,
  requestMediaImport,
} from '@renderer/prep/media/mediaImport';
import type {MediaImportProgress} from '@shared/schema/mediaEdit';
import type {MenuItem} from '@renderer/ui/menuModel';
import type {Notice} from '@renderer/ui/notices';

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
  const reportFailure = useCallback((progress: MediaImportProgress): void => {
    if (!alive.current) return;
    const failure = mediaImportFailureNotice(progress);
    if (failure) report.current(failure);
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
    disabled: window.llp === undefined || busy,
    title: busy ? '미디어를 가져오는 중' : undefined,
    onSelect: start,
  };
}
