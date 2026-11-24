import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/services/contentEdit';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import type {SettingsName} from '@core/schema/app/settingsDocuments';
import {settingsDeleteHistory} from '@renderer/platform/undo/settingsDeleteHistory';

const emptyHistory = {undo: 0, redo: 0, busy: false};
function noSubscribe(): () => void {
  return () => undefined;
}
function noHistory() {
  return emptyHistory;
}

/**
 * Runs the saves of a tool's settings document and tells the operator with
 * `onProblem` when one fails; `busy` while one runs.
 */
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
    readonly history?: SettingsName | undefined;
  };
}) {
  const [busy, setBusy] = useState(false);
  const history = useMemo(
    () =>
      api && area.history ? settingsDeleteHistory(api, area.history) : null,
    [api, area.history],
  );
  const historyState = useSyncExternalStore(
    history?.subscribe ?? noSubscribe,
    history?.get ?? noHistory,
  );
  const pending = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const isActive = (): boolean => active.current;
  const run = async (
    edit: Edit,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<boolean> => {
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
      if (
        (result.ok || result.error.reason === 'write-failed') &&
        edit !== null &&
        typeof edit === 'object' &&
        (('kind' in edit && edit.kind === 'delete') ||
          ('type' in edit && edit.type === 'timer.delete') ||
          ('kind' in edit &&
            edit.kind === 'action' &&
            'action' in edit &&
            edit.action !== null &&
            typeof edit.action === 'object' &&
            'kind' in edit.action &&
            (edit.action.kind === 'remove' ||
              edit.action.kind === 'removeAll')))
      ) {
        const revision = result.ok
          ? result.value.revision
          : result.error.reason === 'write-failed'
            ? result.error.applied.revision
            : null;
        if (revision !== null) history?.record(revision);
      }
      return isActive() && (result.ok || completion === 'applied');
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
  return {busy: busy || historyState.busy, run};
}
