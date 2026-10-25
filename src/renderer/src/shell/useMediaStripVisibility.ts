import {useCallback, useEffect, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {SizeClass} from './sizeClass';

const DEFAULT_MEDIA_MIN_HEIGHT = 900;

/** A loaded choice wins defaults; only an operator's change is saved. */
export function useMediaStripVisibility(
  sizeClass: SizeClass,
  initial: boolean | undefined,
  api: Pick<LlpApi, 'ui' | 'log'> | undefined,
) {
  const [height, setHeight] = useState(() => window.innerHeight);
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
    const resize = (): void => setHeight(window.innerHeight);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return {
    visible:
      choice ?? (sizeClass !== 'narrow' && height >= DEFAULT_MEDIA_MIN_HEIGHT),
    setVisible,
  };
}
