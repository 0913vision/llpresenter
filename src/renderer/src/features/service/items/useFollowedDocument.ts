import {useEffect, useState} from 'react';

interface Revisioned {
  readonly revision: number;
}

/**
 * A document the window keeps current while any panel holds it: `owner` is
 * the API part it comes from, and `name` tells it apart there.
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
  holders: number;
  stop: () => void;
}

// NOTE(0913vision): A panel that mounts again (준비 after 진행) draws with the
// documents it showed before, in its first frame, instead of empty cells for a
// moment. A kept document is followed while any panel holds it (the 준비
// table data is held for the whole window), so what it keeps is always the
// current revision, and it goes when its last holder leaves.
const keptDocuments = new WeakMap<object, Map<string, Kept>>();

function hold<T extends Revisioned>(source: DocumentSource<T>): () => void {
  const kept = source.kept;
  if (kept === undefined) return () => undefined;
  const documents = keptDocuments.get(kept.owner) ?? new Map<string, Kept>();
  keptDocuments.set(kept.owner, documents);
  let entry = documents.get(kept.name);
  if (entry === undefined) {
    const created: Kept = {document: null, holders: 0, stop: () => undefined};
    const accept = (document: T): void => {
      if (
        created.document === null ||
        created.document.revision < document.revision
      ) {
        created.document = document;
      }
    };
    created.stop = source.follow(accept);
    source.read().then(accept, () => undefined);
    documents.set(kept.name, created);
    entry = created;
  }
  const held = entry;
  held.holders += 1;
  return () => {
    held.holders -= 1;
    if (held.holders > 0) return;
    held.stop();
    if (documents.get(kept.name) === held) documents.delete(kept.name);
  };
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
    const release = hold(source);
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
      release();
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
