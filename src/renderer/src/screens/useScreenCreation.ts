import {useLayoutEffect, useRef} from 'react';
import {parseScreenId} from '@shared/schema/ids';
import type {Screen} from '@shared/schema/screens';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NewScreen} from './addScreen';
import {useScreensSelection} from './selection';
import type {NamedDocument} from './useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';

/** Creates screens without overriding a newer selection or an unmounted workspace. */
export function useScreenCreation(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const editor = useScreenEditor(document, onProblem);
  const mounted = useRef(false);
  const latest = useRef<string | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const report = (cause: unknown): void => {
    window.llp?.log.write({
      level: 'error',
      message: 'Could not create a screen',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
    onProblem?.({
      key: 'screens:add',
      kind: 'warning',
      icon: 'warning',
      title: '화면 추가 실패',
      time: noticeTime(),
    });
  };
  return (kind: Screen['kind'], method: NewScreen['method']): void => {
    const id = parseScreenId(crypto.randomUUID());
    if (!id.ok) {
      report(new Error('Invalid generated screen ID'));
      return;
    }
    const previous = useScreensSelection.getState().selection;
    latest.current = id.value;
    editor
      .add({id: id.value, kind, method})
      .then(saved => {
        const current = useScreensSelection.getState();
        if (
          saved &&
          mounted.current &&
          latest.current === id.value &&
          current.selection === previous
        ) {
          current.select('screen', id.value);
        }
      })
      .catch(report);
  };
}
