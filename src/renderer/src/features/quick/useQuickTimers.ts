import {useMemo} from 'react';
import {limitReason} from '@core/common/limitReason';
import {isKnownQuickItem, type QuickItem} from '@core/schema/quick';
import type {Timer} from '@core/schema/timers';
import {MAX_LIVE_TIMERS} from '@core/schema/timerState';
import type {TimerId} from '@core/schema/ids';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/platform/useSettingsDocument';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';

export function useQuickTimers(
  quick: NamedDocument<'quick'> | null,
  onProblem: (notice: Notice) => void,
) {
  const needed =
    quick?.value.items.some(
      item => isKnownQuickItem(item) && item.kind === 'timer',
    ) ?? false;
  const runs = useLive(view => view.state?.timers);
  const full = Object.keys(runs ?? {}).length >= MAX_LIVE_TIMERS;
  const timers = useSettingsDocument(
    needed ? 'timers' : null,
    '타이머',
    onProblem,
  );
  const definitions = useMemo(
    () =>
      new Map<TimerId, Timer>(
        timers?.value.timers.map(timer => [timer.id, timer]),
      ),
    [timers],
  );
  return {
    definitions,
    reason: (item: QuickItem): string | undefined => {
      if (!isKnownQuickItem(item) || item.kind !== 'timer') return undefined;
      if (timers === null) return '타이머를 불러오고 있습니다';
      const timer = definitions.get(item.ref);
      if (!timer) return '타이머를 찾을 수 없습니다';
      if (timer.kind === 'clock') return '시계는 시작하거나 멈추지 않습니다';
      if (runs?.[timer.id] === undefined && full) {
        return limitReason('타이머', MAX_LIVE_TIMERS, '시작');
      }
      return undefined;
    },
  };
}
