import {useEffect, useMemo} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {isKnownQuickItem, type QuickItem} from '@core/schema/tools/quick';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/popups/notices';
import {quickItemUnavailable, quickRunner} from './quickActions';

/**
 * Runs the 빠른 실행 items, by a click or by their own keys. A run still
 * waiting stops when the operator picks another item or slide, when the
 * 빠른 실행 file changes (`document`), or when `selectionVersion` moves on.
 */
export function useQuickRunner({
  api,
  onProblem,
  items,
  timerReason,
  selectionVersion,
  document,
}: {
  readonly api: LlpApi | undefined;
  readonly onProblem: (notice: Notice) => void;
  readonly items: readonly QuickItem[];
  /** Why the timer of an item can't run now, if it can't. */
  readonly timerReason: (item: QuickItem) => string | undefined;
  readonly selectionVersion: number;
  readonly document: unknown;
}) {
  const runner = useMemo(
    () => (api ? quickRunner(api, onProblem) : null),
    [api, onProblem],
  );
  useEffect(() => () => runner?.cancel(), [runner, selectionVersion, document]);
  useEffect(
    () =>
      useShow.subscribe((next, previous) => {
        if (
          next.openItemId !== previous.openItemId ||
          next.selectedTile !== previous.selectedTile
        ) {
          runner?.cancel();
        }
      }),
    [runner],
  );
  useWindowShortcuts(
    items.filter(isKnownQuickItem).map(item => ({
      id: `quick.${item.id}`,
      when: () =>
        quickItemUnavailable(item) === undefined &&
        timerReason(item) === undefined,
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
  );
  return runner;
}
