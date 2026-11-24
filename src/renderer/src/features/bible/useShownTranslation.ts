import {useEffect, useState, type RefObject} from 'react';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {TranslationId} from '@core/schema/common/ids';

/**
 * The translation the passage finder names: the one a lookup in `translation`
 * really reads, which differs when that translation falls back to another
 * (the 실시간 Bible). It is asked for the first recent passage at once, and
 * the form tells it for what it looks up (`found`). An answer that comes back
 * after the operator acted (`intent` moved on) is dropped.
 */
export function useShownTranslation({
  api,
  translation,
  firstRef,
  intent,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly firstRef: string | undefined;
  readonly intent: RefObject<number>;
}) {
  const [resolved, setResolved] = useState<{
    provided: TranslationId | undefined;
    value: TranslationId;
  } | null>(null);
  const found = (value: TranslationId): void =>
    setResolved(previous =>
      previous !== null &&
      previous.provided === translation &&
      previous.value === value
        ? previous
        : {provided: translation, value},
    );
  useEffect(() => {
    let active = true;
    const version = intent.current;
    if (translation !== undefined && firstRef !== undefined) {
      const answer = (value: TranslationId): void => {
        if (!active || intent.current !== version) return;
        setResolved(previous =>
          previous !== null &&
          previous.provided === translation &&
          previous.value === value
            ? previous
            : {provided: translation, value},
        );
      };
      api.lookup({input: firstRef, translation}).then(
        reply =>
          answer(
            reply.effectiveTranslation ??
              (reply.result.ok ? reply.result.value.translation : translation),
          ),
        () => answer(translation),
      );
    }
    return () => {
      active = false;
    };
  }, [api, translation, firstRef, intent]);
  const known = resolved !== null && resolved.provided === translation;
  return {
    /** The translation to name, `translation` until an answer came. */
    shown: known ? resolved.value : translation,
    /** An answer for `translation` came, or there is nothing to ask. */
    known: known || firstRef === undefined,
    found,
  };
}
