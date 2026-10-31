import {useEffect, useState} from 'react';

interface Revisioned {
  readonly revision: number;
}

/** Where a document comes from: one read, and the pushes that follow. */
export interface DocumentSource<T extends Revisioned> {
  readonly read: () => Promise<T>;
  readonly follow: (accept: (document: T) => void) => () => void;
}

export interface FollowedDocument<T> {
  readonly document: T | null;
  readonly failed: boolean;
  readonly retry: () => void;
}

/**
 * Reads a document and follows its newer revisions while mounted. A read that
 * answers after a newer push is dropped. Pass a stable source (`useMemo`).
 * When disabled, it neither reads nor subscribes.
 */
export function useFollowedDocument<T extends Revisioned>(
  source: DocumentSource<T>,
  enabled = true,
): FollowedDocument<T> {
  const [state, setState] = useState<{
    readonly document: T | null;
    readonly failed: boolean;
  }>({document: null, failed: false});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const accept = (document: T): void => {
      if (!alive) return;
      setState(current =>
        current.document !== null &&
        current.document.revision >= document.revision
          ? current
          : {document, failed: false},
      );
    };
    const stop = source.follow(accept);
    source.read().then(accept, (error: unknown) => {
      console.error('Could not read a followed document', error);
      if (alive) {
        setState(current =>
          current.document === null ? {...current, failed: true} : current,
        );
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, [source, attempt, enabled]);
  return {
    ...state,
    retry: () => {
      setState(current => ({...current, failed: false}));
      setAttempt(current => current + 1);
    },
  };
}
