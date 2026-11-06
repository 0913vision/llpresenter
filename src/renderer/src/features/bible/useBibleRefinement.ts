import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleProjection} from './splitProjection';
import {sourceContent} from './splitProjection';
import {BibleRefinementRun} from './BibleRefinements';

/** Owns one cancellable refinement run for the current source and text layout. */
export function useBibleRefinement(
  api: LlpApi['bible'] | undefined,
  projection: BibleProjection | null,
) {
  const content =
    projection === null
      ? null
      : projection.source.kind === 'slides'
        ? JSON.stringify([
            projection.source.id,
            projection.source.input.map(tile => [
              tile.sourceSlideId,
              tile.verse,
            ]),
          ])
        : sourceContent(projection.source);
  const element =
    projection === null
      ? null
      : JSON.stringify([
          projection.element,
          projection.layout.spec,
          projection.appearance?.theme.layout,
        ]);
  const numbered = projection?.numbered;
  const review = projection?.source.review;
  const [request, setRequest] = useState({
    content,
    element,
    numbered,
    review,
    projection,
  });
  if (
    request.content !== content ||
    request.element !== element ||
    request.numbered !== numbered ||
    request.review !== review
  ) {
    setRequest({content, element, numbered, review, projection});
  }
  const run = useMemo(
    () => new BibleRefinementRun(api, request.projection),
    [api, request],
  );
  const progress = useSyncExternalStore(run.subscribe, run.getSnapshot);
  useEffect(() => {
    run
      .start()
      .catch((error: unknown) =>
        console.error('Could not start Bible refinement', error),
      );
    return () => run.cancel();
  }, [run]);
  const current =
    request.content === content &&
    request.element === element &&
    request.numbered === numbered &&
    request.review === review;
  return {
    ...progress,
    initialized: current && progress.initialized,
    cancel: run.cancel,
    identity: run,
  };
}
