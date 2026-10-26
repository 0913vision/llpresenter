import {useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export function useToolEditing<Edit>({
  api,
  write,
  onProblem,
  area,
}: {
  readonly api: LlpApi | undefined;
  readonly write: (api: LlpApi, edit: Edit) => Promise<EditResult>;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly area: {
    readonly key: string;
    readonly label: string;
    readonly log: string;
  };
}) {
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
  const run = async (edit: Edit): Promise<boolean> => {
    if (api === undefined || pending.current || !isActive()) return false;
    pending.current = true;
    setBusy(true);
    const report = (kind: 'save' | 'edit'): void => {
      if (isActive()) {
        onProblem?.({
          key: `${area.key}:${kind}`,
          kind: 'warning',
          icon: 'warning',
          title: `${area.label} ${kind === 'save' ? '저장' : '변경'} 실패`,
          time: noticeTime(),
        });
      }
    };
    try {
      const result = await write(api, edit);
      if (!result.ok) {
        if (result.error.reason !== 'write-failed') {
          throw new Error(result.error.message);
        }
        report('save');
      }
      return isActive();
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: area.log,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report('edit');
      return false;
    } finally {
      pending.current = false;
      if (isActive()) setBusy(false);
    }
  };
  return {busy, run};
}
