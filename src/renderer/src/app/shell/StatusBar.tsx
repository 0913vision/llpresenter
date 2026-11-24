import {NDI_DEFAULT_FPS} from '@core/schema/screens/screens';
import type {JSX, ReactNode} from 'react';
import {controlConflictReason} from '@core/screens';
import {useOutputStatuses} from '@renderer/features/screens/useOutputStatuses';
import {ndiAccelerationLabel} from '@renderer/features/screens/ndiAcceleration';
import {useMonitors} from '@renderer/features/screens/useMonitors';
import {useScreenSummaries} from '../../platform/ScreenSummaries';
import styles from './StatusBar.module.css';

/** The fixed-height status bar shows only conditions requiring attention. */
export function StatusBar({
  standby = false,
  saveState,
  end,
}: {
  readonly standby?: boolean;
  readonly saveState?: 'saving' | 'failed' | undefined;
  /** What stays at the right end, such as the 알림 bell. */
  readonly end?: ReactNode;
}): JSX.Element {
  const screens = useScreenSummaries();
  const statuses = useOutputStatuses();
  const monitors = useMonitors();
  const messages = screens.flatMap(screen => {
    const status = statuses[screen.id];
    if (status === undefined || status.placement === 'off') return [];
    const problems: string[] = [];
    if (status.placement === 'ndi') {
      problems.push(
        `${screen.statusLabel} NDI ${screen.ndiFps ?? NDI_DEFAULT_FPS}fps`,
        ndiAccelerationLabel(status),
      );
    }
    if (status.controlConflict) {
      problems.push(
        `${screen.statusLabel}: ${controlConflictReason(status.monitor)}`,
      );
    } else if (status.placement === 'monitorMissing') {
      problems.push(`${screen.statusLabel} 창으로 표시 중`);
    }
    if (status.renderer === 'restarting') {
      problems.push(`${screen.statusLabel} 출력 창 다시 시작 중`);
    }
    if (status.renderer === 'limited') {
      problems.push(`${screen.statusLabel} 다시 시작 중단`);
    }
    if (status.fpsLow && status.fps !== null) {
      problems.push(
        `${screen.statusLabel} 프레임 낮음 (${Math.round(status.fps)}fps)`,
      );
    }
    return problems;
  });
  return (
    <footer role="status" className={styles.bar}>
      {standby ? <span>대기</span> : null}
      {monitors.some(monitor => monitor.identityUnavailable) ? (
        <span>모니터 정보 확인 안 됨</span>
      ) : null}
      {saveState === 'saving' ? <span>저장을 시도하는 중...</span> : null}
      {saveState === 'failed' ? <span role="alert">저장하지 못함</span> : null}
      {messages.map((message, index) => (
        <span key={`${index}:${message}`}>{message}</span>
      ))}
      {end}
    </footer>
  );
}
