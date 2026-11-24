import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/tools/timers';
import type {TimerRun} from '@core/schema/tools/timerState';
import {isTimerTicking, timerText} from '@core/timers';
import {useTimerNow} from './useTimerNow';

/** The text of a 타이머's value now, drawn again every tick while it runs. */
export function TimerValue({
  api,
  timer,
  run,
}: {
  readonly api: LlpApi;
  readonly timer: Timer;
  readonly run: TimerRun | undefined;
}): JSX.Element {
  const now = useTimerNow(api, isTimerTicking(timer, run));
  return <span>{timerText(timer, run, now)}</span>;
}
