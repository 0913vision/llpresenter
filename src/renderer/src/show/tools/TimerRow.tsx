import {memo, type JSX} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {Timer} from '@shared/schema/timers';
import {MAX_LIVE_TIMERS} from '@shared/schema/timerState';
import {useLive} from '@renderer/state/live';
import {Button, Icon, TruncatedText} from '@renderer/ui';
import {TimerValue} from './TimerValue';
import styles from './TimerTab.module.css';

function kindText(timer: Timer): string {
  switch (timer.kind) {
    case 'countdown':
      return timer.duration % 60 === 0
        ? `${timer.duration / 60}분`
        : `${timer.duration}초`;
    case 'countdownTo':
      return `${timer.date ? `${timer.date} ` : ''}${timer.time}까지`;
    case 'elapsed':
      return '경과';
    case 'elapsedFrom':
      return `시각 경과 ${timer.time}`;
    case 'clock':
      return '시계';
  }
}

export const TimerRow = memo(
  ({
    api,
    timer,
  }: {
    readonly api: LlpApi;
    readonly timer: Timer;
  }): JSX.Element => {
    const run = useLive(view => view.state?.timers?.[timer.id]);
    const full = useLive(
      view => Object.keys(view.state?.timers ?? {}).length >= MAX_LIVE_TIMERS,
    );
    const running = run?.state === 'running';
    const reason =
      run === undefined && full
        ? '시작할 수 있는 타이머가 가득 찼습니다'
        : undefined;
    return (
      <section
        className={styles.row}
        role="group"
        aria-label={timer.name || '이름 없음'}
      >
        <div className={styles.heading}>
          <Icon name="timer" size={16} />
          <TruncatedText
            className={styles.name}
            text={timer.name || '이름 없음'}
          />
          <span className={styles.kind}>{kindText(timer)}</span>
        </div>
        <div className={styles.reading}>
          <div className={styles.value}>
            <TimerValue api={api} timer={timer} run={run} />
          </div>
          {timer.kind === 'clock' ? null : (
            <div className={styles.actions}>
              <Button
                disabled={reason !== undefined}
                title={reason}
                onClick={() =>
                  api.live.send({
                    type: running ? 'timer.pause' : 'timer.start',
                    timerId: timer.id,
                  })
                }
              >
                {running ? '일시 정지' : '시작'}
              </Button>
              <Button
                disabled={run === undefined}
                title={run === undefined ? '타이머가 멈춰 있습니다' : undefined}
                onClick={() =>
                  api.live.send({type: 'timer.reset', timerId: timer.id})
                }
              >
                처음으로
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  },
);
