import {useEffect, useState} from 'react';

interface Revisioned {
  readonly revision: number;
}

/**
 * A document the window keeps current while it runs: `owner` is the API part
 * it comes from, and `name` tells it apart there. A name that ends in `:` and
 * an id (`service:<id>`) keeps only the newest id of its kind.
 */
export interface KeptName<T extends Revisioned> {
  readonly owner: object;
  readonly name: string;
  /** Whether a kept document is one of this source's documents. */
  readonly is: (document: Revisioned) => document is T;
}

/** Where a document comes from: one read, and the pushes that follow. */
export interface DocumentSource<T extends Revisioned> {
  readonly read: () => Promise<T>;
  readonly follow: (accept: (document: T) => void) => () => void;
  readonly kept?: KeptName<T> | undefined;
}

interface Kept {
  document: Revisioned | null;
  stop: () => void;
}

// NOTE(0913vision): A panel that mounts again (준비 after 진행) draws with the
// documents it showed before, in its first frame, instead of empty cells for a
// moment. The window keeps following each kept document after its panels
// leave, so what it keeps is always the current revision.
const keptDocuments = new WeakMap<object, Map<string, Kept>>();

function keep<T extends Revisioned>(
  source: DocumentSource<T>,
): Kept | undefined {
  const kept = source.kept;
  if (kept === undefined) return undefined;
  const documents = keptDocuments.get(kept.owner) ?? new Map<string, Kept>();
  keptDocuments.set(kept.owner, documents);
  const found = documents.get(kept.name);
  if (found !== undefined) return found;
  const kind = kept.name.includes(':')
    ? kept.name.slice(0, kept.name.indexOf(':') + 1)
    : null;
  if (kind !== null) {
    for (const [name, other] of documents) {
      if (name.startsWith(kind)) {
        other.stop();
        documents.delete(name);
      }
    }
  }
  const entry: Kept = {document: null, stop: () => undefined};
  const accept = (document: T): void => {
    if (
      entry.document === null ||
      entry.document.revision < document.revision
    ) {
      entry.document = document;
    }
  };
  entry.stop = source.follow(accept);
  documents.set(kept.name, entry);
  source.read().then(accept, () => {
    entry.stop();
    if (documents.get(kept.name) === entry) documents.delete(kept.name);
  });
  return entry;
}

function keptDocument<T extends Revisioned>(
  source: DocumentSource<T>,
): T | null {
  const kept = source.kept;
  if (kept === undefined) return null;
  const document = keptDocuments.get(kept.owner)?.get(kept.name)?.document;
  return document !== undefined && document !== null && kept.is(document)
    ? document
    : null;
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
  }>(() => ({
    document: enabled ? keptDocument(source) : null,
    failed: false,
  }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    keep(source);
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
