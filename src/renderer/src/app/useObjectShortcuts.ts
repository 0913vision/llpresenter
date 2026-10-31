import {useEffect, useMemo, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import type {Notice} from '@renderer/ui/notices';
import {sendLive} from '@renderer/session/live';
import {
  quickRunner,
  quickItemUnavailable,
} from '@renderer/features/quick/quickActions';
import {isKnownQuickItem} from '@core/schema/quick';
import {
  toggleProp,
  toggleTimer,
  resetTimer,
} from '@renderer/features/tools/toolCommands';

/** Keeps assigned per-object commands available even when their panel is closed. */
export function useObjectShortcuts(
  api: LlpApi | undefined,
  report: (notice: Notice) => void,
): void {
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const ids = Object.keys(bindings).filter(
    id => (bindings[id]?.length ?? 0) > 0,
  );
  const needs = (prefix: string): boolean =>
    ids.some(id => id.startsWith(prefix));
  const macros = useSettingsDocument(
    needs('macro.') ? 'macros' : null,
    '매크로',
    report,
  );
  const props = useSettingsDocument(
    needs('prop.') ? 'props' : null,
    '그래픽',
    report,
  );
  const timers = useSettingsDocument(
    needs('timer.') ? 'timers' : null,
    '타이머',
    report,
  );
  const quick = useSettingsDocument(
    needs('quick.') ? 'quick' : null,
    '퀵 실행',
    report,
  );
  const runner = useMemo(
    () => (api === undefined ? null : quickRunner(api, report)),
    [api, report],
  );
  useEffect(() => () => runner?.cancel(), [runner, quick]);
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
    ...(quick?.value.items ?? []).filter(isKnownQuickItem).map(item => ({
      id: `quick.${item.id}`,
      when: () => quickItemUnavailable(item) === undefined,
      run: () => {
        runner?.run(item).catch((error: unknown) =>
          api?.log.write({
            level: 'error',
            message: 'Could not run quick shortcut',
            detail: String(error),
          }),
        );
      },
    })),
  ]);
}
