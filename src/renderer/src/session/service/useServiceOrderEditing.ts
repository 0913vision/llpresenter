import {logFailure} from '@renderer/platform/logFailure';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import type {OpenServiceResult} from './openService';
import {orderFailureNotice} from './serviceProblem';

type Operation = () => Promise<OpenServiceResult>;

/**
 * Runs the edits of the 예배 순서 and reports why one was refused. Every press
 * counts: the open service's editor applies the edits in order and shows each
 * at once, so a second Delete or Alt+Down pressed before the first is saved
 * works on what the first left.
 */
export function useServiceOrderEditing(onProblem: (notice: Notice) => void) {
  const execute = async (
    operation: Operation,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<boolean> => {
    const api = window.llp;
    if (api === undefined) return false;
    try {
      let result = await operation();
      if (result.ok && !result.value && completion === 'saved') {
        const persisted = await api.content.edit({type: 'saves.retry'});
        result = persisted.ok ? {ok: true, value: true} : persisted;
      }
      if (!result.ok) {
        onProblem(
          orderFailureNotice(
            `service-order:${result.error.reason}`,
            result.error,
            '예배 변경 실패',
          ),
        );
      }
      return result.ok;
    } catch (cause) {
      logFailure(api, 'Could not edit the service order', cause);
      onProblem(warningNotice('service-order:request', '예배 변경 실패'));
      return false;
    }
  };
  return {
    run: (operation: Operation): void => {
      execute(operation).catch((error: unknown) =>
        console.error('Could not change the service', error),
      );
    },
    apply: (operation: Operation) => execute(operation),
    save: (operation: Operation) => execute(operation, 'saved'),
  };
}
