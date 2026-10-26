import {useEffect, useEffectEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {OutputStatuses} from '@shared/schema/outputStatus';
import {defaultScreens} from '@renderer/shell/screens';
import {
  dropOutputWarning,
  keepOutputWarning,
  useOutputWarnings,
} from '@renderer/state/outputWarnings';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  outputNoticeChanges,
  type NoticeChange,
  type ScreenNames,
} from './outputNotices';

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
  /** The cards showing now. */
  readonly getNotices: () => readonly Notice[];
}

// NOTE(0913vision): The session closes a card when one of its buttons is
// pressed. An action such as 모니터 다시 찾기 may change nothing, and then no
// new status brings the card back, so the card shows again right after its
// action while its warning still holds.
function keptAfterActions(
  notice: Notice,
  report: (notice: Notice) => void,
): Notice {
  const showAgain = (): void => {
    const kept = useOutputWarnings.getState().warnings.get(notice.key);
    if (kept !== undefined) report(kept.notice);
  };
  return {
    ...notice,
    actions: notice.actions?.map(action => ({
      ...action,
      onSelect: () => {
        action.onSelect();
        showAgain();
      },
    })),
  };
}

/**
 * Turns output status updates into the lost monitor and restart limit cards,
 * and keeps each unresolved warning for the 출력 menu. The first status read
 * counts only when no push came before it.
 */
export function useOutputNotices(
  api: Pick<LlpApi, 'output'> | undefined,
  target: NoticeTarget,
): void {
  const report = useEffectEvent(target.report);
  const dismiss = useEffectEvent(target.dismiss);
  const isShowing = useEffectEvent((key: string) =>
    target.getNotices().some(notice => notice.key === key),
  );
  useEffect(() => {
    if (api === undefined) return undefined;
    const {output} = api;
    let previous: OutputStatuses = {};
    let stopped = false;
    let pushed = false;
    const take = (change: NoticeChange): void => {
      if (change.kind === 'dismiss') {
        dropOutputWarning(change.key);
        dismiss(change.key);
        return;
      }
      if (change.notice.kind !== 'warning') {
        dropOutputWarning(change.notice.key);
        report(change.notice);
        return;
      }
      const notice = keptAfterActions(change.notice, report);
      keepOutputWarning({
        screenId: change.screenId,
        screenName: screenNames.get(change.screenId)?.window ?? change.screenId,
        notice,
      });
      if (change.kind === 'show' || isShowing(notice.key)) report(notice);
    };
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
      for (const change of changes) take(change);
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
