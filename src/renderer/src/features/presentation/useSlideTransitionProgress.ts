import {useEffect, useMemo, useState} from 'react';
import {useLive} from '@renderer/session/live';
import {slideTransitionFor} from '@core/output/transitions';
import type {TransitionProgress} from '@renderer/ui/transitionProgress';

/** Follows the actual live slide transition using main's wall clock start. */
export function useSlideTransitionProgress(): TransitionProgress | undefined {
  const slide = useLive(view => view.state?.layers.slide);
  const startedAt = slide?.transitionStartedAt;
  const effect = slideTransitionFor(slide ?? null);
  const duration = effect.kind === 'none' ? 0 : effect.sec * 1000;
  const end = startedAt === undefined ? undefined : startedAt + duration;
  const [finished, setFinished] = useState<number | undefined>();
  useEffect(() => {
    if (end === undefined || duration <= 0) return;
    const timer = setTimeout(
      () => setFinished(end),
      Math.max(0, end - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [end, duration]);
  return useMemo(() => {
    if (
      startedAt === undefined ||
      end === undefined ||
      duration <= 0 ||
      finished === end
    ) {
      return undefined;
    }
    return {startedAt, duration};
  }, [startedAt, duration, end, finished]);
}
