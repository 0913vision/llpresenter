import {useMemo} from 'react';
import {limitReason} from '@core/common/limitReason';
import {isKnownQuickItem, type QuickItem} from '@core/schema/tools/quick';
import type {Timer} from '@core/schema/tools/timers';
import {MAX_LIVE_TIMERS} from '@core/schema/tools/timerState';
import type {TimerId} from '@core/schema/common/ids';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/popups/notices';
import {type NamedDocument} from '@core/schema/app/settingsDocuments';

/**
 * The definitions of the timers that quick items point at, by id, and the
 * reason a timer item can't start now, if any.
 */
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
      if (timers === null) return '타이머 불러오는 중';
      const timer = definitions.get(item.ref);
      if (!timer) return '타이머를 찾을 수 없습니다.';
      if (timer.kind === 'clock') return '시계는 시작과 멈춤이 없습니다.';
      if (runs?.[timer.id] === undefined && full) {
        return limitReason('타이머', MAX_LIVE_TIMERS, '시작');
      }
      return undefined;
    },
  };
}
