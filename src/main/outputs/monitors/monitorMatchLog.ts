import type {MatchDiagnostic} from '../../displays/assign';
import type {Monitor} from '../../displays/monitor';
import type {OutputScreen} from '../screens';

/**
 * What the log says about one screen's monitor: the monitor it got and by
 * which rule (or that it took the control window's monitor), or why it got
 * none.
 */
export function monitorMatchDetail(
  screen: Pick<OutputScreen, 'id' | 'method' | 'display'>,
  {
    monitor,
    controlMonitorId,
    match,
  }: {
    readonly monitor: Monitor | undefined;
    readonly controlMonitorId: number | undefined;
    readonly match: MatchDiagnostic | undefined;
  },
): Record<string, string | number> {
  if (monitor === undefined) {
    return {
      screen: screen.id,
      monitor: 'unmatched',
      reason:
        screen.method !== 'fullscreen' || screen.display === null
          ? 'not applicable'
          : match !== undefined && 'reason' in match
            ? match.reason
            : 'no candidate',
    };
  }
  const rule = match !== undefined && 'rule' in match ? match.rule : undefined;
  const onControl = monitor.id === controlMonitorId;
  return {
    screen: screen.id,
    monitor: monitor.id,
    rule: onControl ? 'control conflict' : (rule ?? 'unknown'),
    ...(onControl && rule !== undefined ? {matchedBy: rule} : {}),
  };
}
