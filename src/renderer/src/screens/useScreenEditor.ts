import {useLayoutEffect, useRef} from 'react';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from './useSettingsDocument';
import {ScreenEditor} from './screenEditor';
import type {ScreenChange} from './screenEdits';
import type {MonitorInfo} from '@shared/schema/monitors';

const SAVE_FAILED_TITLE = '화면 설정 저장 실패';

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
  const report = useRef(onProblem);
  const editor = useRef<ScreenEditor | null>(null);
  useLayoutEffect(() => {
    report.current = onProblem;
    const api = window.llp;
    if (api !== undefined && editor.current === null) {
      editor.current = new ScreenEditor(api, () =>
        report.current?.({
          key: 'screens:save',
          kind: 'warning',
          icon: 'warning',
          title: SAVE_FAILED_TITLE,
          time: noticeTime(),
        }),
      );
    }
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
