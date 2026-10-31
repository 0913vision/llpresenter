import {useEffect, useRef, useState} from 'react';
import {createServiceId, type ServiceId} from '@core/schema/ids';
import {
  serviceOrderEditsFor,
  type ServiceOrderEdits,
  type ServiceOrderEditResult,
} from '@renderer/session/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';

type Operation = (
  edits: ServiceOrderEdits,
  serviceId: ServiceId,
) => Promise<ServiceOrderEditResult>;

/** Keeps edit history across workspace switches, without retaining old APIs. */
export function useServiceOrderEditing(
  serviceId: string | null,
  onProblem: (notice: Notice) => void,
) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const execute = async (
    operation: Operation,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<boolean> => {
    const api = window.llp;
    if (pending.current || api === undefined || serviceId === null) {
      return false;
    }
    pending.current = true;
    setBusy(true);
    try {
      const editor = serviceOrderEditsFor(api);
      let result = await operation(editor, createServiceId(serviceId));
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
              ? '예배 순서 저장 실패'
              : '예배 순서 변경 실패',
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
      onProblem({
        key: 'service-order:request',
        kind: 'warning',
        icon: 'warning',
        title: '예배 순서 변경 실패',
        time: noticeTime(),
      });
      return false;
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const run = (operation: Operation): void => {
    execute(operation).catch((error: unknown) => {
      console.error('Failed to report a service order edit:', error);
    });
  };
  return {
    busy,
    run,
    save: (operation: Operation) => execute(operation, 'saved'),
  };
}
