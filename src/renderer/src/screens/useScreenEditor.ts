import {useLayoutEffect, useRef} from 'react';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NamedDocument} from './useSettingsDocument';
import {ScreenEditor} from './screenEditor';
import type {ScreenChange} from './screenEdits';

const SAVE_FAILED_TITLE = '화면 설정 저장 실패';

/**
 * Saves changes to the screens through one {@link ScreenEditor}, which keeps
 * the newest revision between saves. A refused save reaches `onProblem` as a
 * notice.
 *
 * @returns A function that saves a change to one screen.
 */
export function useScreenEditor(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
): (screenId: string, change: ScreenChange) => void {
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
  return (screenId, change) => {
    editor.current?.change(screenId, change).catch((cause: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not save the screens',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    });
  };
}
