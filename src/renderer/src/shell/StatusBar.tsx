import type {JSX} from 'react';
import {useOutputStatuses} from '@renderer/screens/useOutputStatuses';
import {useScreenSummaries} from './ScreenSummaries';
import styles from './StatusBar.module.css';

/** The fixed-height status bar shows only conditions requiring attention. */
export function StatusBar({
  standby = false,
  saveState,
}: {
  readonly standby?: boolean;
  readonly saveState?: 'saving' | 'failed' | undefined;
}): JSX.Element {
  const screens = useScreenSummaries();
  const statuses = useOutputStatuses();
  const messages = screens.flatMap(screen => {
    const status = statuses[screen.id];
    if (status === undefined || status.placement === 'off') return [];
    const problems: string[] = [];
    if (status.placement === 'monitorMissing') {
      problems.push(`${screen.statusLabel} 창으로 표시 중`);
    }
    if (status.renderer === 'restarting') {
      problems.push(`${screen.statusLabel} 출력 창을 다시 시작하는 중`);
    }
    if (status.renderer === 'limited') {
      problems.push(`${screen.statusLabel} 다시 시작 시도 제한됨`);
    }
    if (status.fpsLow && status.fps !== null) {
      problems.push(
        `프레임 속도가 낮아지는 중: ${screen.statusLabel} (${Math.round(status.fps)}fps)`,
      );
    }
    return problems;
  });
  return (
    <footer role="status" className={styles.bar}>
      {standby ? <span>대기</span> : null}
      {saveState === 'saving' ? <span>저장을 시도하는 중...</span> : null}
      {saveState === 'failed' ? <span>저장하지 못함</span> : null}
      {messages.map(message => (
        <span key={message}>{message}</span>
      ))}
    </footer>
  );
}
