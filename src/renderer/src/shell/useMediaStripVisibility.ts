import {useCallback, useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {UI_ZOOM_FACTOR} from '@core/schema/uiZoom';
import type {SizeClass} from '../ui/sizeClass';

const DEFAULT_MEDIA_MIN_HEIGHT_DIP = 900;

function windowHeightDip(api: Pick<LlpApi, 'ui'> | undefined): number {
  return (
    window.innerHeight * (api?.ui.getZoomFactor() ?? UI_ZOOM_FACTOR.default)
  );
}

/** A loaded choice wins defaults; only an operator's change is saved. */
export function useMediaStripVisibility(
  sizeClass: SizeClass,
  initial: boolean | undefined,
  api: Pick<LlpApi, 'ui' | 'log'> | undefined,
) {
  const [heightDip, setHeightDip] = useState(() => windowHeightDip(api));
  const [choice, setChoice] = useState(initial);
  const setVisible = useCallback(
    (visible: boolean): void => {
      setChoice(visible);
      try {
        api?.ui.setMediaStrip({visible});
      } catch (cause) {
        api?.log.write({
          level: 'error',
          message: 'Could not save media strip visibility',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      }
    },
    [api],
  );
  useEffect(() => {
    const resize = (): void => setHeightDip(windowHeightDip(api));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [api]);
  return {
    visible:
      choice ??
      (sizeClass !== 'narrow' && heightDip >= DEFAULT_MEDIA_MIN_HEIGHT_DIP),
    setVisible,
  };
}
