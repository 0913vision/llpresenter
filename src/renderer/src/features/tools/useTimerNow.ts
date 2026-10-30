import {useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {TimerNow} from '@core/timers/timerClock';
import {MainTimerClock} from '@renderer/rendering/mainTimerClock';

const TIMER_TICK_MS = 250;
const noSubscription = () => () => undefined;

class TimerClock {
  private clock: MainTimerClock | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<() => void>();
  private snapshot: TimerNow = {
    timer: performance.timeOrigin + performance.now(),
    wall: Date.now(),
  };

  constructor(private readonly api: LlpApi) {}

  readonly now = (): TimerNow =>
    this.clock?.now() ?? {
      timer: performance.timeOrigin + performance.now(),
      wall: Date.now(),
    };
  readonly getSnapshot = (): TimerNow => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.interval === null) {
      this.clock ??= new MainTimerClock(
        async () => this.api.live.clock(),
        (message, cause) =>
          this.api.log.write({
            level: 'error',
            message,
            detail: cause instanceof Error ? cause.message : String(cause),
          }),
      );
      this.snapshot = this.now();
      this.interval = setInterval(() => {
        this.snapshot = this.now();
        for (const notify of this.listeners) notify();
      }, TIMER_TICK_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.interval !== null) {
        clearInterval(this.interval);
        this.interval = null;
      }
    };
  };
}

const clocks = new WeakMap<LlpApi, TimerClock>();

export function useTimerNow(api: LlpApi, ticking: boolean): TimerNow {
  let clock = clocks.get(api);
  if (clock === undefined) {
    clock = new TimerClock(api);
    clocks.set(api, clock);
  }
  const snapshot = useSyncExternalStore(
    ticking ? clock.subscribe : noSubscription,
    clock.getSnapshot,
    clock.getSnapshot,
  );
  return ticking ? snapshot : clock.now();
}
