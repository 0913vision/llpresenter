import {useEffect, useState} from 'react';
import type {Screen} from '@shared/schema/screens';
import type {LooksFile} from '@shared/schema/looks';
import type {LiveState} from '@shared/live';
import {showsLayer, resolveScreenLook} from '@renderer/render/screenLook';

export function hasMovingSeconds(
  screens: readonly Screen[],
  looks: LooksFile | null,
  liveState: LiveState | null,
): boolean {
  if (liveState === null || screens.length === 0) return false;
  const hasMedia = liveState.layers.media !== null;
  const hasTimedMessage =
    liveState.layers.message?.items?.some(m => m.expiresAt !== null) === true;

  if (!hasMedia && !hasTimedMessage) return false;

  for (const screen of screens) {
    if (screen.kind !== 'audience') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (hasMedia && showsLayer(appearance, 'media')) return true;
    if (hasTimedMessage && showsLayer(appearance, 'message')) return true;
  }
  return false;
}

export function hasClockRow(
  screens: readonly Screen[],
  looks: LooksFile | null,
  liveState: LiveState | null,
): boolean {
  if (liveState === null || screens.length === 0) return false;
  for (const screen of screens) {
    if (screen.kind !== 'stage') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (showsLayer(appearance, 'clock')) return true;
  }
  return false;
}

export interface ClockOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
}

/** Ticks time only while a timed row exists: at 1 s for seconds, or at minute boundaries for the clock. */
export function useShowingClock(options: ClockOptions): number {
  const {screens, looks, liveState} = options;
  const [internalNow, setInternalNow] = useState(() => Date.now());

  const movingSeconds = hasMovingSeconds(screens, looks, liveState);
  const clockActive = hasClockRow(screens, looks, liveState);

  useEffect(() => {
    if (movingSeconds) {
      queueMicrotask(() => {
        setInternalNow(Date.now());
      });
      const timer = setInterval(() => {
        setInternalNow(Date.now());
      }, 1000);
      return () => {
        clearInterval(timer);
      };
    }

    if (clockActive) {
      queueMicrotask(() => {
        setInternalNow(Date.now());
      });
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const scheduleNext = () => {
        const current = Date.now();
        const seconds = new Date(current).getSeconds();
        const ms = Math.max(1000, (60 - seconds) * 1000);
        timeoutId = setTimeout(() => {
          setInternalNow(Date.now());
          scheduleNext();
        }, ms);
      };
      scheduleNext();
      return () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
    }

    return undefined;
  }, [movingSeconds, clockActive]);

  return internalNow;
}
