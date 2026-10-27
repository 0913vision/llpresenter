import {useEffect, useMemo, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {isKnownQuickItem, type QuickItem} from '@shared/schema/quick';
import type {Timer} from '@shared/schema/timers';
import {MAX_LIVE_TIMERS} from '@shared/schema/timerState';
import type {TimerId, QuickItemId} from '@shared/schema/ids';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/screens/useSettingsDocument';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {useLive} from '@renderer/state/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export function useQuickTimers(
  api: LlpApi | undefined,
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
  const [failed, setFailed] = useState<string | null>(null);
  const problemShown = useRef(false);
  const definitions = useMemo(
    () =>
      new Map<TimerId, Timer>(
        timers?.value.timers.map(timer => [timer.id, timer]),
      ),
    [timers],
  );
  const duplicates = useMemo(() => {
    const seen = new Set<TimerId>();
    const secondary = new Set<QuickItemId>();
    for (const item of quick?.value.items ?? []) {
      if (
        !isKnownQuickItem(item) ||
        item.kind !== 'timer' ||
        !definitions.has(item.ref)
      ) {
        continue;
      }
      if (seen.has(item.ref)) secondary.add(item.id);
      else seen.add(item.ref);
    }
    return secondary;
  }, [quick, definitions]);
  const key = `${quick?.revision}:${timers?.revision}`;
  const readOnly =
    quick?.access !== 'editable' || timers?.access !== 'editable';
  useEffect(() => {
    if (
      duplicates.size === 0 &&
      problemShown.current &&
      quick?.value.items.every(
        item =>
          !isKnownQuickItem(item) ||
          item.kind !== 'timer' ||
          definitions.has(item.ref),
      )
    ) {
      problemShown.current = false;
      onProblem({
        key: 'quick:timer-separation',
        kind: 'info',
        icon: 'check',
        title: '타이머 분리 완료',
        time: noticeTime(),
      });
    }
    if (!api || readOnly || duplicates.size === 0 || failed === key) {
      return undefined;
    }
    let active = true;
    const report = (cause: unknown): void => {
      api.log.write({
        level: 'error',
        message: 'Could not separate shared quick timers',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (!active) return;
      problemShown.current = true;
      setFailed(key);
      onProblem({
        key: 'quick:timer-separation',
        kind: 'warning',
        icon: 'warning',
        title: '타이머 분리 실패',
        time: noticeTime(),
        actions: [
          {
            icon: 'refresh',
            label: '다시 시도',
            onSelect: () => setFailed(null),
          },
        ],
      });
    };
    pendingWritesOf(api)
      .run<EditResult | null>({
        write: async () =>
          api.settings.edit({type: 'quick.timers.separate', name: 'quick'}),
        refused: null,
        sent: outcome =>
          outcome !== null &&
          (outcome.ok || outcome.error.reason === 'write-failed'),
      })
      .then(result => {
        if (
          result !== null &&
          !result.ok &&
          result.error.reason !== 'write-failed'
        ) {
          report(new Error(result.error.message));
        }
      }, report);
    return () => {
      active = false;
    };
  }, [api, readOnly, duplicates, failed, key, onProblem, quick, definitions]);
  return {
    definitions,
    reason: (item: QuickItem): string | undefined => {
      if (!isKnownQuickItem(item) || item.kind !== 'timer') return undefined;
      if (timers === null) return '타이머를 불러오고 있습니다';
      const timer = definitions.get(item.ref);
      if (!timer) return '타이머를 찾을 수 없습니다';
      if (duplicates.has(item.id)) {
        return readOnly
          ? '읽기 전용 타이머는 분리할 수 없습니다'
          : failed === key
            ? '타이머를 분리하지 못했습니다'
            : '타이머를 분리하고 있습니다';
      }
      if (timer.kind === 'clock') return '시계는 시작하거나 멈추지 않습니다';
      if (runs?.[timer.id] === undefined && full) {
        return '시작할 수 있는 타이머가 가득 찼습니다';
      }
      return undefined;
    },
  };
}
