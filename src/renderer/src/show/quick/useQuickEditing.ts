import {useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {saveQuickEdit, type QuickEdit} from './quickEdits';

export function useQuickEditing(
  api: LlpApi | undefined,
  onProblem: (notice: Notice) => void,
) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const run = async (edit: QuickEdit): Promise<boolean> => {
    if (api === undefined || pending.current || !active.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      await saveQuickEdit(api, edit);
      return active.current;
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not edit the quick list',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (active.current)
        onProblem({
          key: 'quick:edit',
          kind: 'warning',
          icon: 'warning',
          title: '퀵 실행 변경 실패',
          time: noticeTime(),
        });
      return false;
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return {busy, run};
}
