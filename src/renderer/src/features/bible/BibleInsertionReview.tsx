import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {verseKey} from '@core/bible/bibleTiles';
import {useShow} from '@renderer/session/show';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {
  installBibleInsertionReview,
  type BibleInsertionRequest,
  type ReviewedVerses,
} from './reviewBibleInsertion';

interface Insertion extends BibleInsertionRequest {
  readonly complete: (verses: ReviewedVerses | null) => void;
}

/** Hosts passage review across the service table, palette, and preview. */
export function BibleInsertionReview(): JSX.Element | null {
  const serviceId = useShow(view => view.serviceId);
  const serviceEpoch = useShow(view => view.serviceEpoch);
  const api = window.llp;
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const pending = useRef<Insertion | null>(null);
  const reviewed = useRef<Record<string, readonly string[]>>({});
  useLayoutEffect(() => {
    if (api === undefined || serviceId === null) return;
    const uninstall = installBibleInsertionReview(request => {
      const view = useShow.getState();
      if (
        pending.current !== null ||
        request.serviceId !== serviceId ||
        request.serviceEpoch !== serviceEpoch ||
        view.serviceId !== serviceId ||
        view.serviceEpoch !== serviceEpoch
      ) {
        return Promise.resolve(null);
      }
      return new Promise(resolve => {
        const next: Insertion = {...request, complete: resolve};
        pending.current = next;
        setInsertion(next);
      });
    });
    return () => {
      uninstall();
      pending.current?.complete(null);
      pending.current = null;
      reviewed.current = {};
    };
  }, [api, serviceId, serviceEpoch]);
  if (
    api === undefined ||
    insertion?.serviceEpoch !== serviceEpoch ||
    insertion.serviceId !== serviceId
  ) {
    return null;
  }
  const finish = (confirmed: boolean): void => {
    const current = pending.current;
    if (current !== insertion) return;
    pending.current = null;
    setInsertion(null);
    const verses = reviewed.current;
    reviewed.current = {};
    current.complete(confirmed ? verses : null);
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
