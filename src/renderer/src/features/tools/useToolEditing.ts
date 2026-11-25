import {logFailure} from '@renderer/platform/logFailure';
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
import {failureReasonLines} from '@renderer/platform/problemReasons';

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
    /**
     * The deletions this area keeps for 실행 취소: the settings document they
     * are made in, and which edits delete.
     */
    readonly deletions?:
      | {
          readonly name: SettingsName;
          readonly of: (edit: Edit) => boolean;
        }
      | undefined;
  };
}) {
  const [busy, setBusy] = useState(false);
  const deletions = area.deletions?.name;
  const history = useMemo(
    () =>
      api && deletions !== undefined
        ? settingsDeleteHistory(api, deletions)
        : null,
    [api, deletions],
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
    const report = (kind: 'save' | 'edit', reason?: string): void => {
      if (isActive()) {
        const why = reason === undefined ? [] : failureReasonLines(reason);
        onProblem?.({
          key: `${area.key}:${kind}`,
          kind: 'warning',
          icon: 'warning',
          title: `${area.label} ${kind === 'save' ? '저장' : '변경'} 실패`,
          time: noticeTime(),
          ...(why.length === 0 ? {} : {meta: why}),
        });
      }
    };
    try {
      const result = await write(api, edit);
      if (!result.ok && result.error.reason !== 'write-failed') {
        logFailure(api, area.log, new Error(result.error.message));
        report('edit', result.error.reason);
        return false;
      }
      if (!result.ok) report('save', result.error.reason);
      if (area.deletions?.of(edit) === true) {
        // NOTE(0913vision): A deletion that was applied but could not be
        // written still happened, so it can be undone too.
        const revision = result.ok
          ? result.value.revision
          : result.error.reason === 'write-failed'
            ? result.error.applied.revision
            : null;
        if (revision !== null) history?.record(revision);
      }
      return isActive() && (result.ok || completion === 'applied');
    } catch (cause) {
      logFailure(api, area.log, cause);
      report('edit');
      return false;
    } finally {
      pending.current = false;
      if (isActive()) setBusy(false);
    }
  };
  return {busy: busy || historyState.busy, run};
}
