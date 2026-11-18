import {useCallback, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SizeClass} from '../../ui/sizeClass';

/** A loaded choice wins defaults; only an operator's change is saved. */
export function useMediaStripVisibility(
  _sizeClass: SizeClass,
  initial: boolean | undefined,
  api: Pick<LlpApi, 'ui' | 'log'> | undefined,
) {
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
  return {
    visible: choice ?? false,
    setVisible,
  };
}
