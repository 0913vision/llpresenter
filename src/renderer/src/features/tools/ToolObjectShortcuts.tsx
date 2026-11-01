import type {LlpApi} from '@contracts/ipc/api';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useBoundCommands} from '@renderer/platform/useBoundCommands';
import type {Notice} from '@renderer/ui/notices';

import {sendLive} from '@renderer/session/live';
import {toggleProp, toggleTimer, resetTimer} from './toolCommands';

/** Keeps macro, prop, and timer commands registered while their panels close. */
export function ToolObjectShortcuts(input: {
  readonly api: LlpApi | undefined;
  readonly onProblem: (notice: Notice) => void;
}): null {
  useToolObjectShortcuts(input);
  return null;
}

/** Registers the existing tool commands and releases settings on unmount. */
export function useToolObjectShortcuts({
  onProblem,
}: {
  readonly api: LlpApi | undefined;
  readonly onProblem: (notice: Notice) => void;
}): void {
  const needs = useBoundCommands();
  const macros = useSettingsDocument(
    needs('macro.') ? 'macros' : null,
    '매크로',
    onProblem,
  );
  const props = useSettingsDocument(
    needs('prop.') ? 'props' : null,
    '그래픽',
    onProblem,
  );
  const timers = useSettingsDocument(
    needs('timer.') ? 'timers' : null,
    '타이머',
    onProblem,
  );
  useWindowShortcuts([
    ...(macros?.value.macros ?? []).map(macro => ({
      id: `macro.${macro.id}`,
      run: () => sendLive({type: 'macro.run', macroId: macro.id}),
    })),
    ...(props?.value.props ?? []).map(prop => ({
      id: `prop.${prop.id}`,
      run: () => toggleProp(prop.id),
    })),
    ...(timers?.value.timers ?? []).flatMap(timer => [
      {id: `timer.${timer.id}.toggle`, run: () => toggleTimer(timer)},
      {id: `timer.${timer.id}.reset`, run: () => resetTimer(timer)},
    ]),
  ]);
}
