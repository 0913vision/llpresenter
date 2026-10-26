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
  const isActive = (): boolean => active.current;
  const run = async (edit: QuickEdit): Promise<boolean> => {
    if (api === undefined || pending.current || !isActive()) return false;
    pending.current = true;
    setBusy(true);
    try {
      await saveQuickEdit(api, edit);
      return isActive();
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not edit the quick list',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (isActive()) {
        onProblem({
          key: 'quick:edit',
          kind: 'warning',
          icon: 'warning',
          title: '퀵 실행 변경 실패',
          time: noticeTime(),
        });
      }
      return false;
    } finally {
      pending.current = false;
      if (isActive()) setBusy(false);
    }
  };
  return {busy, run};
}
