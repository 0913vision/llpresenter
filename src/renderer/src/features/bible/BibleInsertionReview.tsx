import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {useShow} from '@renderer/session/show';
import {BibleAddSplitReview} from './BibleAddSplitReview';
import {installBibleInsertionReview} from './reviewBibleInsertion';
import type {BibleProjection} from './splitProjection';

interface Insertion {
  readonly serviceId: string;
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseInput['reference']>;
  readonly complete: (confirmed: boolean) => void;
}

/** Hosts passage review across the service table, palette, and preview. */
export function BibleInsertionReview(): JSX.Element | null {
  const serviceId = useShow(view => view.serviceId);
  const api = window.llp;
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const pending = useRef<Insertion | null>(null);
  useLayoutEffect(() => {
    if (api === undefined || serviceId === null) return;
    const uninstall = installBibleInsertionReview((projection, references) => {
      if (pending.current !== null) return Promise.resolve(false);
      return new Promise<boolean>(complete => {
        const next = {serviceId, projection, references, complete};
        pending.current = next;
        setInsertion(next);
      });
    });
    return () => {
      uninstall();
      pending.current?.complete(false);
      pending.current = null;
    };
  }, [api, serviceId]);
  if (api === undefined || insertion?.serviceId !== serviceId) {
    return null;
  }
  const finish = (confirmed: boolean): void => {
    const current = pending.current;
    if (current !== insertion) return;
    pending.current = null;
    setInsertion(null);
    current.complete(confirmed);
  };
  return (
    <BibleAddSplitReview
      projection={insertion.projection}
      references={insertion.references}
      api={api}
      onCancel={() => finish(false)}
      onComplete={() => finish(true)}
    />
  );
}
