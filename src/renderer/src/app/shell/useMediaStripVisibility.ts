import {logFailure} from '@renderer/platform/logFailure';
import {useCallback, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';

/** A loaded choice wins defaults; only an operator's change is saved. */
export function useMediaStripVisibility(
  initial: boolean | undefined,
  api: Pick<LlpApi, 'ui' | 'log'> | undefined,
) {
  const [choice, setChoice] = useState(initial);
  const setVisible = useCallback(
    (visible: boolean): void => {
      setChoice(visible);
      try {
        api?.ui.setRememberedView({mediaStrip: visible});
      } catch (cause) {
        logFailure(api, 'Could not save media strip visibility', cause);
      }
    },
    [api],
  );
  return {
    visible: choice ?? false,
    setVisible,
  };
}
