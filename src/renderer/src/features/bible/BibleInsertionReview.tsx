import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {verseKey} from '@core/slides/passageSlides';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {
  installBibleInsertionReview,
  type BibleInsertionRequest,
  type ReviewedVerses,
} from './reviewBibleInsertion';

interface Insertion extends BibleInsertionRequest {
  readonly complete: (verses: ReviewedVerses | null) => void;
}

/** Looks over the long verses of a passage wherever it is being put in. */
export function BibleInsertionReview(): JSX.Element | null {
  const api = window.llp;
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const pending = useRef<Insertion | null>(null);
  const reviewed = useRef<Record<string, readonly string[]>>({});
  useLayoutEffect(() => {
    const uninstall = installBibleInsertionReview(request => {
      if (pending.current !== null) return Promise.resolve(null);
      return new Promise(resolve => {
        const next: Insertion = {...request, complete: resolve};
        reviewed.current = {};
        pending.current = next;
        setInsertion(next);
      });
    });
    return () => {
      uninstall();
      pending.current?.complete(null);
      pending.current = null;
    };
  }, []);
  if (api === undefined || insertion === null) return null;
  const finish = (confirmed: boolean): void => {
    if (pending.current !== insertion) return;
    pending.current = null;
    setInsertion(null);
    insertion.complete(confirmed ? reviewed.current : null);
  };
  return (
    <BibleAddSplitReview
      projection={insertion.projection}
      references={insertion.references}
      api={api}
      onConfirmed={(verse, texts) => {
        if (pending.current === insertion) {
          reviewed.current[verseKey(verse.reference)] = texts;
        }
      }}
      onCancel={() => finish(false)}
      onComplete={() => finish(true)}
    />
  );
}
