import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible';
import type {BibleSplit} from '../passageSplitter';
import {BibleRefinementRun} from './BibleRefinements';

/** Owns one cancellable refinement run for the current verses and text box. */
export function useBibleRefinement(
  api: LlpApi['bible'] | undefined,
  split: BibleSplit,
  {
    references,
  }: {
    readonly references?: ReadonlyArray<VerseInput['reference']> | undefined;
  } = {},
) {
  const key = JSON.stringify([split.verses, split.layout.spec, split.numbered]);
  const [request, setRequest] = useState({key, split});
  if (request.key !== key) setRequest({key, split});
  const run = useMemo(
    () => new BibleRefinementRun(api, request.split),
    [api, request],
  );
  const progress = useSyncExternalStore(run.subscribe, run.getSnapshot);
  useEffect(() => {
    run
      .start({references})
      .catch((error: unknown) =>
        console.error('Could not start Bible refinement', error),
      );
    return () => run.cancel();
  }, [run, references]);
  return {
    ...progress,
    initialized: request.key === key && progress.initialized,
    cancel: run.cancel,
    suggestCuts: run.suggestCuts,
  };
}
