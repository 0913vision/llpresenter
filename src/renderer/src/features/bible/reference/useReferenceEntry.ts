import {useState} from 'react';
import type {ReferencePart} from '@core/bible';
import type {TranslationId} from '@core/schema/common/ids';
import {fieldsOfReference} from './referenceForm';
import {useChosenRecent} from './useChosenRecent';

/**
 * What the operator has entered in a reference form: the four fields, or a
 * whole recent passage chosen instead of them, and the field that a refused
 * submit marks.
 */
export function useReferenceEntry(
  initialRef: string | undefined,
  provided: TranslationId | undefined,
) {
  const [fields, setFields] = useState(() => fieldsOfReference(initialRef));
  const [blocked, setBlocked] = useState<ReferencePart | null>(null);
  const chosen = useChosenRecent(provided);
  return {
    fields,
    setFields,
    blocked,
    setBlocked,
    /** A recent passage chosen whole, read instead of the fields. */
    recent: chosen.recent,
    setRecent: chosen.choose,
    /** The translation to read: the chosen passage's, else the given one. */
    translation: chosen.translation,
  };
}

export type ReferenceEntry = ReturnType<typeof useReferenceEntry>;
