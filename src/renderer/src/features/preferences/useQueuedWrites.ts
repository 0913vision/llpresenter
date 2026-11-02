import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';
import type {EditResult} from '@core/schema/contentEdit';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import type {Notice} from '@renderer/ui/notices';
import {noticeTime} from '@renderer/ui/notices';

/** A settings document as a window follows it. */
export interface WritableDocument<TValue> {
  readonly revision: number;
  readonly access: 'editable' | 'readOnly';
  readonly value: TValue;
}

interface QueuedWritesInput<TDocument extends WritableDocument<unknown>> {
  readonly document: TDocument | null;
  /** Sends the whole new file against the revision of the document it came from. */
  readonly send: (
    base: TDocument,
    value: TDocument['value'],
  ) => Promise<EditResult>;
  /** The notice that a refused or failed write shows. */
  readonly failure: Notice;
  readonly onProblem: (notice: Notice) => void;
}

/**
 * Saves changes of one settings document one after another. Each write is
 * built on the revision and value of the one before it, taken from its reply,
 * and never on an older document than one a push already brought. The close
 * gate decides whether a write starts at all.
 *
 * @returns A function that saves one change of the stored value.
 */
export function useQueuedWrites<TDocument extends WritableDocument<unknown>>({
  document,
  send,
  failure,
  onProblem,
}: QueuedWritesInput<TDocument>): (
  next: (stored: TDocument['value']) => TDocument['value'],
) => void {
  const latest = useRef(document);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);
  const sendLatest = useRef(send);
  useLayoutEffect(() => {
    sendLatest.current = send;
    if (
      document !== null &&
      document.revision >= (latest.current?.revision ?? 0)
    ) {
      latest.current = document;
    }
  }, [document, send]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const report = useCallback(() => {
    if (alive.current) onProblem({...failure, time: noticeTime()});
  }, [onProblem, failure]);
  return useCallback(
    (next: (stored: TDocument['value']) => TDocument['value']): void => {
      const api = window.llp;
      if (api === undefined) {
        report();
        return;
      }
      const write = async (): Promise<boolean> => {
        const base = latest.current;
        if (base?.access !== 'editable') {
          report();
          return false;
        }
        try {
          const value = next(base.value);
          const result = await sendLatest.current(base, value);
          if (!result.ok) {
            report();
            return false;
          }
          const {revision} = result.value;
          if (revision !== null && revision > (latest.current?.revision ?? 0)) {
            latest.current = {...base, revision, value};
          }
          return true;
        } catch (cause: unknown) {
          console.error('Could not save a setting:', cause);
          report();
          return false;
        }
      };
      pendingWritesOf(api)
        .run({
          write: () => {
            const queued = chain.current.then(write, write);
            chain.current = queued;
            return queued;
          },
          refused: false,
          sent: sent => sent,
        })
        .catch((cause: unknown) =>
          console.error('Could not register a setting write:', cause),
        );
    },
    [report],
  );
}
