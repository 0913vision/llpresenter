import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {cacheKey} from '@core/bible/split/splitCache';
import type {BibleCutEntry} from '@core/schema/bibleCuts';
import {useShow} from '@renderer/session/show';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {
  installBibleInsertionReview,
  type BibleInsertionRequest,
} from './reviewBibleInsertion';

interface Insertion extends BibleInsertionRequest {
  readonly complete: (
    cuts: Readonly<Record<string, BibleCutEntry>> | null,
  ) => void;
}

/** Hosts passage review across the service table, palette, and preview. */
export function BibleInsertionReview(): JSX.Element | null {
  const serviceId = useShow(view => view.serviceId);
  const serviceEpoch = useShow(view => view.serviceEpoch);
  const api = window.llp;
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const pending = useRef<Insertion | null>(null);
  const cuts = useRef<Record<string, BibleCutEntry>>({});
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
      cuts.current = {};
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
    const entries = cuts.current;
    cuts.current = {};
    current.complete(confirmed ? entries : null);
  };
  return (
    <BibleAddSplitReview
      projection={insertion.projection}
      references={insertion.references}
      api={api}
      onConfirmed={(verse, entry) => {
        if (pending.current === insertion) {
          cuts.current[cacheKey(verse.reference)] = entry;
        }
      }}
      onCancel={() => finish(false)}
      onComplete={() => finish(true)}
    />
  );
}
