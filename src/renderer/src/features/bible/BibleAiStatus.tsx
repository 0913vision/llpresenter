import {useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleAiState} from '@core/schema/bibleAi';
import {titleTooltip, useTooltip} from '@renderer/ui/Tooltip';
import styles from './BibleAiStatus.module.css';

/** The optional local chooser's state, without explanatory helper text. */
export function BibleAiStatus({
  api,
}: {
  readonly api: LlpApi['bible'] | undefined;
}): JSX.Element {
  const [state, setState] = useState<BibleAiState>({
    status: 'stopped',
    available: false,
    reason: '',
  });
  useEffect(() => {
    if (api === undefined) return;
    let active = true;
    let pushed = false;
    const stop = api.onLlmStatus(value => {
      pushed = true;
      if (active) setState(value);
    });
    void api.getLlmStatus().then(
      value => {
        if (active && !pushed) setState(value);
      },
      (error: unknown) =>
        console.error('Could not read local AI status', error),
    );
    return () => {
      active = false;
      stop();
    };
  }, [api]);
  const label =
    state.status === 'ready'
      ? 'AI 켜짐'
      : state.status === 'starting'
        ? 'AI 켜는 중'
        : 'AI 꺼짐';
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(state.status === 'failed' ? state.reason : undefined),
  );
  return (
    <span {...targetProps} className={styles.status} data-status={state.status}>
      <span className={styles.dot} />
      {label}
      {tooltip}
    </span>
  );
}
