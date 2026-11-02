import {useLayoutEffect, useRef} from 'react';
import {parseScreenId, type ScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import type {MonitorInfo} from '@core/schema/monitors';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NewScreen} from './addScreen';
import {useScreensSelection} from './selection';
import type {NamedDocument} from '../../platform/useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';

/**
 * Creates screens without overriding a newer selection or an unmounted
 * workspace. A screen added while its group is on is switched on once saved,
 * through `switchOn`.
 */
export function useScreenCreation(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
  switchOn: (screenId: ScreenId) => void,
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
  return (
    kind: Screen['kind'],
    method: NewScreen['method'],
    options: {
      readonly monitor?: MonitorInfo | undefined;
      /** Whether the group of the new screen is on, so the screen starts on. */
      readonly groupOn?: boolean;
    } = {},
  ): void => {
    const {monitor, groupOn = false} = options;
    const id = parseScreenId(crypto.randomUUID());
    if (!id.ok) {
      report(new Error('Invalid generated screen ID'));
      return;
    }
    const previous = useScreensSelection.getState().selection;
    latest.current = id.value;
    editor
      .add({
        id: id.value,
        kind,
        method,
        ...(monitor === undefined ? {} : {monitor}),
      })
      .then(saved => {
        if (saved && groupOn) switchOn(id.value);
        const current = useScreensSelection.getState();
        if (
          saved &&
          mounted.current &&
          latest.current === id.value &&
          current.selection === previous
        ) {
          current.select(id.value);
        }
      })
      .catch(report);
  };
}
