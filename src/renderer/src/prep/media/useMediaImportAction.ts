import {useEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@shared/schema/mediaEdit';

/** Shares loading/read-only checks and the synchronous double-click guard. */
export function useMediaImportAction(
  document: MediaDocument | null,
  run: (files?: readonly File[]) => Promise<void>,
) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const reason = busy
    ? '미디어를 가져오는 중'
    : document === null
      ? '미디어를 불러오는 중'
      : document.access !== 'editable'
        ? '읽기 전용 미디어'
        : undefined;
  const startImport = (files?: readonly File[]): void => {
    if (!mounted.current || reason !== undefined || pending.current) return;
    pending.current = true;
    setBusy(true);
    (async () => {
      try {
        await run(files);
      } catch (error: unknown) {
        console.error('Media import failed:', error);
      } finally {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    })().catch((error: unknown) => {
      console.error('Media import callback failed:', error);
    });
  };
  return {reason, startImport, isPending: () => pending.current};
}
