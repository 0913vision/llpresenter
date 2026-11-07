import type {JSX} from 'react';
import {useOutputStatuses} from '@renderer/features/screens/useOutputStatuses';
import {useScreenSummaries} from '../../platform/ScreenSummaries';
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
      {saveState === 'saving' ? <span>저장을 시도하는 중...</span> : null}
      {saveState === 'failed' ? <span role="alert">저장하지 못함</span> : null}
      {messages.map(message => (
        <span key={message}>{message}</span>
      ))}
    </footer>
  );
}
