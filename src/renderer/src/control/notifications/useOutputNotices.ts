import {useEffect, useEffectEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {OutputStatuses} from '@shared/schema/outputStatus';
import {defaultScreens} from '@renderer/shell/screens';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {outputNoticeChanges, type ScreenNames} from './outputNotices';

// TODO(0913vision): Name the screens from the screen settings once they reach
// the control window; until then only the built-in screens get cards.
const screenNames: ReadonlyMap<string, ScreenNames> = new Map(
  defaultScreens.map(screen => [
    screen.id,
    {monitor: screen.toolbarLabel, window: screen.statusLabel},
  ]),
);

/** Where the cards go: the app's one notice list. */
export interface NoticeTarget {
  readonly report: (notice: Notice) => void;
  readonly dismiss: (key: string) => void;
}

/**
 * Turns output status updates into the lost monitor and restart limit cards.
 * The first status read counts only when no push came before it.
 */
export function useOutputNotices(
  api: Pick<LlpApi, 'output'> | undefined,
  target: NoticeTarget,
): void {
  const report = useEffectEvent(target.report);
  const dismiss = useEffectEvent(target.dismiss);
  useEffect(() => {
    if (api === undefined) return undefined;
    const {output} = api;
    let previous: OutputStatuses = {};
    let stopped = false;
    let pushed = false;
    const apply = (next: OutputStatuses): void => {
      if (stopped) return;
      const changes = outputNoticeChanges({
        previous,
        next,
        screens: screenNames,
        actions: {
          findMonitors: () => output.findMonitors(),
          showWindow: screenId => output.showWindow(screenId),
          retry: screenId => output.retry(screenId),
        },
        time: noticeTime(),
      });
      previous = next;
      for (const change of changes) {
        if (change.kind === 'show') report(change.notice);
        else dismiss(change.key);
      }
    };
    const unsubscribe = output.subscribeStatus(next => {
      pushed = true;
      apply(next);
    });
    output.getStatus().then(
      next => {
        if (!pushed) apply(next);
      },
      // NOTE(0913vision): The preload logs a failed or malformed read before
      // it rejects; the next push brings the status.
      () => undefined,
    );
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [api]);
}
