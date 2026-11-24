import {useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {
  BibleDisplay,
  BibleSource,
} from '@renderer/session/show/bibleSource';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/show/showOutput';
import {openBiblePassage} from '../actions';

/** How the passage of `source` shows now. */
export function displayOf({
  verseNumbers,
  translationName,
  transition,
  review,
  enteredRef,
  enteredTranslation,
}: BibleSource): BibleDisplay {
  return {
    verseNumbers,
    translationName,
    transition,
    review,
    enteredRef,
    enteredTranslation,
  };
}

/** What a swap that failed writes to the log and shows on its control. */
export interface SwapFailure {
  readonly log: string;
  readonly problem: string;
}

/** How a swap ended: opened, nothing to open, or another came first. */
export type SwapResult = 'opened' | 'none' | 'passed';

/**
 * Opens another reading of the passage that shows, such as one more verse or
 * another translation, on the verse that is selected. One swap runs at a
 * time, and a swap is dropped when the operator moved on before it answered.
 */
export function usePassageSwap(source: BibleSource): {
  readonly busy: boolean;
  readonly problem: string | undefined;
  readonly swap: (
    load: (
      api: LlpApi,
      current: () => boolean,
    ) => Promise<BibleLookupPassage | null>,
    failure: SwapFailure,
  ) => Promise<SwapResult>;
} {
  const locked = useRef(false);
  const lifetime = useRef({active: true});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
    };
  }, []);
  const swap = async (
    load: (
      api: LlpApi,
      current: () => boolean,
    ) => Promise<BibleLookupPassage | null>,
    failure: SwapFailure,
  ): Promise<SwapResult> => {
    const api = window.llp;
    if (!api || locked.current) return 'passed';
    locked.current = true;
    setBusy(true);
    setProblem(undefined);
    const owner = lifetime.current;
    const request = beginOutputRequest();
    const commandVersion = useLive.getState().commandVersion;
    const {selectedTile} = useShow.getState();
    const current = (): boolean => {
      const view = useShow.getState();
      return (
        owner.active &&
        bibleSourceFor(view, view.openItemId) === source &&
        view.selectedTile === selectedTile &&
        isOutputRequestCurrent(request, commandVersion)
      );
    };
    try {
      const passage = await load(api, current);
      if (!current()) return 'passed';
      if (passage === null) return 'none';
      openBiblePassage(
        passage,
        {
          ...displayOf(source),
          enteredRef: source.enteredRef ?? source.passage.ref,
          enteredTranslation:
            source.enteredTranslation ?? source.passage.translation,
        },
        {keepsVerse: true},
      );
      return 'opened';
    } catch (cause) {
      if (current()) {
        api.log.write({
          level: 'error',
          message: failure.log,
          detail: String(cause),
        });
        setProblem(failure.problem);
      }
      return 'passed';
    } finally {
      if (owner.active) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  return {busy, problem, swap};
}
