import {useLayoutEffect, useRef} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from '../../../platform/useSettingsDocument';
import {StageEditor} from './stageEditor';

const sessions = new WeakMap<LlpApi, ReturnType<typeof createSession>>();
function createSession(api: LlpApi) {
  const reporters = new Map<(notice: Notice) => void, number>();
  const report = (): void => {
    for (const listener of [...reporters.keys()]) {
      listener({
        key: 'stage:save',
        kind: 'warning',
        icon: 'warning',
        title: '무대 배치 저장 실패',
        time: noticeTime(),
      });
    }
  };
  return {reporters, report, editor: new StageEditor(api, report)};
}

/** Shares stage writes across list/canvas remounts, including the normal close flush. */
export function useStageEditor(
  document: NamedDocument<'stage-layouts'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const reference = useRef<ReturnType<typeof createSession> | null>(null);
  const api = window.llp;
  useLayoutEffect(() => {
    if (api === undefined) return undefined;
    let session = sessions.get(api);
    if (session === undefined) {
      session = createSession(api);
      sessions.set(api, session);
    }
    reference.current = session;
    if (onProblem !== undefined) {
      session.reporters.set(
        onProblem,
        (session.reporters.get(onProblem) ?? 0) + 1,
      );
    }
    return () => {
      if (onProblem !== undefined) {
        const count = session.reporters.get(onProblem) ?? 0;
        if (count <= 1) session.reporters.delete(onProblem);
        else session.reporters.set(onProblem, count - 1);
      }
      reference.current = null;
    };
  }, [api, onProblem]);
  useLayoutEffect(() => {
    reference.current?.editor.adopt(document);
  });
  return <T>(
    action: (editor: StageEditor) => Promise<T>,
    completed?: (value: T) => void,
    failed?: () => void,
  ): void => {
    const session = reference.current;
    if (session === null) {
      failed?.();
      return;
    }
    action(session.editor)
      .then(value => completed?.(value))
      .catch((cause: unknown) => {
        api?.log.write({
          level: 'error',
          message: 'Could not edit stage layouts',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        session.report();
        failed?.();
      });
  };
}
