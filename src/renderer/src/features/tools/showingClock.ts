import {useEffect, useState} from 'react';
import type {Screen} from '@core/schema/screens';
import type {LooksFile} from '@core/schema/looks';
import type {LiveState} from '@core/live/state';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {MediaItem} from '@core/schema/mediaList';
import {showsLayer, resolveScreenLook} from '@renderer/rendering/screenLook';

export function hasMovingSeconds({
  screens,
  looks,
  liveState,
  mediaItems,
}: ClockOptions): boolean {
  if (liveState === null || screens.length === 0) return false;
  const media = mediaItems.find(
    item => item.id === liveState.layers.media?.mediaId,
  );
  const hasMedia = media?.kind === 'video' && (media.duration ?? 0) > 0;
  const messages = liveState.layers.message?.items ?? [];

  if (!hasMedia && messages.length === 0) return false;

  for (const screen of screens) {
    if (screen.kind !== 'audience') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (hasMedia && showsLayer(appearance, 'media')) return true;
    if (
      showsLayer(appearance, 'message') &&
      messages.some(
        message =>
          message.expiresAt !== null &&
          (message.targets === 'all' || message.targets.includes(screen.id)) &&
          !message.excludedTargets.includes(screen.id),
      )
    ) {
      return true;
    }
  }
  return false;
}

export function hasClockRow({
  screens,
  looks,
  liveState,
  stageLayoutsFile,
}: ClockOptions): boolean {
  if (liveState === null || screens.length === 0) return false;
  for (const screen of screens) {
    if (screen.kind !== 'stage') continue;
    const {appearance} = resolveScreenLook(looks, liveState.lookId, screen);
    if (!showsLayer(appearance, 'clock')) continue;
    const layoutId =
      liveState.stageLayouts?.[screen.id] ?? appearance?.stageLayout;
    const layout = stageLayoutsFile?.layouts.find(item => item.id === layoutId);
    if (layout?.elements.some(element => element.kind === 'clock')) return true;
  }
  return false;
}

export interface ClockOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
  readonly stageLayoutsFile: StageLayoutsFile | null;
  readonly mediaItems: readonly MediaItem[];
}

/** Ticks time only while a timed row exists: at 1 s for seconds, or at minute boundaries for the clock. */
export function useShowingClock(options: ClockOptions): number {
  const [internalNow, setInternalNow] = useState(() => Date.now());

  const movingSeconds = hasMovingSeconds(options);
  const clockActive = hasClockRow(options);

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
