import type {JSX} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {Timer} from '@shared/schema/timers';
import type {TimerRun} from '@shared/schema/timerState';
import {isTimerTicking, timerText} from '@shared/timerClock';
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
