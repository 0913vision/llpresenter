import {useEffect, useState} from 'react';
import {useLive} from '@renderer/session/live';

/** Follows the actual live slide transition using main's wall clock start. */
export function useSlideTransitionProgress(): number | undefined {
  const slide = useLive(view => view.state?.layers.slide);
  const start = slide?.transitionStartedAt;
  const effect =
    slide?.reverseTransition !== undefined
      ? slide.reverseTransition
      : slide?.transition;
  const duration =
    effect == null || effect.kind === 'none'
      ? 0
      : effect.sec * (effect.kind === 'wipe' ? 830 : 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start === undefined || duration <= 0) return;
    let handle = 0;
    const update = (): void => {
      const current = Date.now();
      setNow(current);
      if (current < start + duration) handle = requestAnimationFrame(update);
    };
    handle = requestAnimationFrame(update);
    return () => cancelAnimationFrame(handle);
  }, [start, duration]);
  if (start === undefined || duration <= 0) return undefined;
  const elapsed = Math.max(0, now - start);
  return elapsed >= duration ? undefined : elapsed / duration;
}
