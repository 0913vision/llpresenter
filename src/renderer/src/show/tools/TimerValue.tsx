import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/timers';
import type {TimerRun} from '@core/schema/timerState';
import {isTimerTicking, timerText} from '@core/timers/timerClock';
import {useTimerNow} from './useTimerNow';

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
