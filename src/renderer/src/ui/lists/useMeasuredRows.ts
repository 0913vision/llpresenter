import {
  isLayoutResizeActive,
  onLayoutResizeEnd,
} from '@renderer/ui/panels/layoutResize';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  reconcileSlideRowMeasurements,
  type SlideRowMeasurements,
} from '../tiles/slideRowMeasurements';

export interface MeasuredRows {
  readonly current: SlideRowMeasurements;
  readonly saveHeight: (id: string, height: number) => void;
}

/** Retains measured heights for current rows until the view or width changes. */
export function useMeasuredRows(
  scope: string,
  ids: readonly string[],
  viewportRef: RefObject<HTMLDivElement | null>,
): MeasuredRows {
  const [cache, setCache] = useState(() =>
    reconcileSlideRowMeasurements(
      {scope, ids: new Set(), values: {}},
      scope,
      ids,
    ),
  );
  const current = reconcileSlideRowMeasurements(cache, scope, ids);
  if (current !== cache) setCache(current);
  const [generation, setGeneration] = useState(0);
  const activeGeneration = useRef(0);
  const saveHeight = useCallback(
    (id: string, height: number) => {
      if (generation !== activeGeneration.current) return;
      setCache(previous =>
        previous.scope !== scope ||
        !previous.ids.has(id) ||
        previous.values[id] === height
          ? previous
          : {...previous, values: {...previous.values, [id]: height}},
      );
    },
    [scope, generation],
  );
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || typeof ResizeObserver === 'undefined') return;
    let width = viewport.clientWidth;
    const read = () => {
      if (viewport.clientWidth === width) return;
      width = viewport.clientWidth;
      setCache(previous => ({...previous, values: {}}));
      activeGeneration.current += 1;
      setGeneration(activeGeneration.current);
    };
    const observer = new ResizeObserver(() => {
      if (!isLayoutResizeActive()) read();
    });
    const unlisten = onLayoutResizeEnd(read);
    observer.observe(viewport);
    return () => {
      unlisten();
      observer.disconnect();
    };
  }, [viewportRef]);
  return {current, saveHeight};
}
