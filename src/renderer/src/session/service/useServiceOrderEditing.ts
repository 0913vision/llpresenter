import {useRef, useState} from 'react';
import {
  type Notice,
  noticeTime,
  warningNotice,
} from '@renderer/ui/popups/notices';
import type {OpenServiceResult} from './openService';
import {orderFailureTitle} from './serviceProblem';
import {useAlive} from '@renderer/ui/useAlive';

type Operation = () => Promise<OpenServiceResult>;

/** Runs one edit of the 예배 순서 at a time and reports why one was refused. */
export function useServiceOrderEditing(onProblem: (notice: Notice) => void) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useAlive();
  const execute = async (
    operation: Operation,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<boolean> => {
    const api = window.llp;
    if (pending.current || api === undefined) return false;
    pending.current = true;
    setBusy(true);
    try {
      let result = await operation();
      if (result.ok && !result.value && completion === 'saved') {
        const persisted = await api.content.edit({type: 'saves.retry'});
        result = persisted.ok ? {ok: true, value: true} : persisted;
      }
      if (!result.ok) {
        onProblem({
          key: `service-order:${result.error.reason}`,
          kind: 'warning',
          icon: 'warning',
          title:
            result.error.reason === 'write-failed'
              ? '예배 저장 실패'
              : orderFailureTitle(result.error, '예배 변경 실패'),
          time: noticeTime(),
        });
      }
      return result.ok;
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not edit the service order',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      onProblem(warningNotice('service-order:request', '예배 변경 실패'));
      return false;
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return {
    busy,
    run: (operation: Operation): void => {
      execute(operation).catch((error: unknown) =>
        console.error('Could not change the service', error),
      );
    },
    apply: (operation: Operation) => execute(operation),
    save: (operation: Operation) => execute(operation, 'saved'),
  };
}
