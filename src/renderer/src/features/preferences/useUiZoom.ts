import {useCallback, useEffect, useState} from 'react';

/**
 * The UI zoom percentage, kept in step with Ctrl +, Ctrl -, and Ctrl 0 in any
 * window; null until the first read.
 */
export function useUiZoom(): {
  readonly percent: number | null;
  readonly setPercent: (percent: number) => void;
} {
  const [percent, setCurrent] = useState<number | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let alive = true;
    const accept = (next: number): void => {
      if (alive) setCurrent(next);
    };
    const stop = api.ui.onZoomChanged(accept);
    api.ui.getZoom().then(accept, (error: unknown) => {
      console.error('Could not read the UI zoom', error);
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  const setPercent = useCallback((next: number) => {
    window.llp?.ui
      .changeZoom({type: 'ui.zoomSet', percent: next})
      .catch((error: unknown) =>
        console.error('Could not set the zoom', error),
      );
  }, []);
  return {percent, setPercent};
}
