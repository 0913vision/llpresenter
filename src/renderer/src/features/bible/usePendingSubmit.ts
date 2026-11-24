import {useEffect, useEffectEvent, useRef} from 'react';
import type {ReferencePart} from '@core/bible';
import type {BibleLookupReply} from '@core/schema/bible/bibleLookup';
import type {TranslationId} from '@core/schema/common/ids';

/** A passage asked for before its lookup came back. */
export interface PendingSubmit {
  readonly input: string;
  readonly translation: TranslationId;
  /** The last verse the field shows once the passage is in. */
  readonly clampedEnd: number | undefined;
  /** The field the reason shows on when the passage is not found. */
  readonly part: ReferencePart;
}

/**
 * Sends a passage asked for while its lookup still runs, once the reply for
 * it comes back. A change of the reference or the translation in between
 * forgets it.
 */
export function usePendingSubmit({
  reply,
  input,
  translation,
  settle,
}: {
  readonly reply: BibleLookupReply | null;
  readonly input: string;
  readonly translation: TranslationId | undefined;
  readonly settle: (
    pending: PendingSubmit,
    result: BibleLookupReply['result'],
  ) => void;
}) {
  const pending = useRef<PendingSubmit | null>(null);
  const settleReply = useEffectEvent(settle);
  useEffect(() => {
    const waiting = pending.current;
    if (waiting === null) return;
    if (waiting.input !== input || waiting.translation !== translation) {
      pending.current = null;
      return;
    }
    if (reply === null) return;
    pending.current = null;
    settleReply(waiting, reply.result);
  }, [reply, input, translation]);
  return {
    wait: (next: PendingSubmit): void => {
      pending.current = next;
    },
    forget: (): void => {
      pending.current = null;
    },
  };
}
