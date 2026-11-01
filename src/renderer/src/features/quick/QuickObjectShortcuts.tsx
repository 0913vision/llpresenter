import {useEffect, useMemo} from 'react';
import {isKnownQuickItem} from '@core/schema/quick';
import type {LlpApi} from '@contracts/ipc/api';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useBoundCommands} from '@renderer/platform/useBoundCommands';
import type {Notice} from '@renderer/ui/notices';

import {quickRunner, quickItemUnavailable} from './quickActions';

/** Keeps quick shortcuts available and owns their delayed-run lifetime. */
export function QuickObjectShortcuts(input: {
  readonly api: LlpApi | undefined;
  readonly onProblem: (notice: Notice) => void;
}): null {
  useQuickObjectShortcuts(input);
  return null;
}

/** Cancels the quick runner when settings change or the owner unmounts. */
export function useQuickObjectShortcuts({
  api,
  onProblem,
}: {
  readonly api: LlpApi | undefined;
  readonly onProblem: (notice: Notice) => void;
}): void {
  const needs = useBoundCommands();
  const quick = useSettingsDocument(
    needs('quick.') ? 'quick' : null,
    '퀵 실행',
    onProblem,
  );
  const runner = useMemo(
    () => (api === undefined ? null : quickRunner(api, onProblem)),
    [api, onProblem],
  );
  useEffect(() => () => runner?.cancel(), [runner, quick]);
  useWindowShortcuts([
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
