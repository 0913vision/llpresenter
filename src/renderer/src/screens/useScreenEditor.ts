import {useLayoutEffect, useRef} from 'react';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from './useSettingsDocument';
import {ScreenEditor} from './screenEditor';
import type {ScreenChange} from './screenEdits';
import type {MonitorInfo} from '@shared/schema/monitors';
import type {LlpApi} from '@shared/ipc';
import type {EditProblemReporter} from './screenEditor';

const SAVE_FAILED_TITLE = '화면 설정 저장 실패';
const sessions = new WeakMap<LlpApi, ReturnType<typeof createSession>>();

function createSession(api: LlpApi) {
  const reporters = new Set<EditProblemReporter>();
  return {
    reporters,
    editor: new ScreenEditor(api, reason =>
      reporters.values().next().value?.(reason),
    ),
  };
}

function sessionFor(api: LlpApi) {
  let session = sessions.get(api);
  if (session === undefined) {
    session = createSession(api);
    sessions.set(api, session);
  }
  return session;
}

/**
 * Saves changes to the screens through one {@link ScreenEditor}, which keeps
 * the newest revision between saves. A refused save reaches `onProblem` as a
 * notice.
 *
 * @returns Actions that save property changes and monitor assignments.
 */
export function useScreenEditor(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const editor = useRef<ScreenEditor | null>(null);
  const api = window.llp;
  useLayoutEffect(() => {
    if (api === undefined) return undefined;
    const session = sessionFor(api);
    const reportProblem: EditProblemReporter = () =>
      onProblem?.({
        key: 'screens:save',
        kind: 'warning',
        icon: 'warning',
        title: SAVE_FAILED_TITLE,
        time: noticeTime(),
      });
    if (onProblem !== undefined) session.reporters.add(reportProblem);
    editor.current = session.editor;
    return () => {
      session.reporters.delete(reportProblem);
      editor.current = null;
    };
  }, [api, onProblem]);
  useLayoutEffect(() => {
    editor.current?.adopt(document);
  });
  const run = (action: (current: ScreenEditor) => Promise<void>): void => {
    if (editor.current === null) return;
    action(editor.current).catch((cause: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not save the screens',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    });
  };
  return {
    change: (screenId: string, change: ScreenChange): void =>
      run(current => current.change(screenId, change)),
    assign: (screenId: string, monitor: MonitorInfo): void =>
      run(current => current.assign(screenId, monitor)),
  };
}
