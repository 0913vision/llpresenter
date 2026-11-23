import {useCallback, useMemo, useState} from 'react';
import type {Label} from '@core/schema/labels';
import {
  importHeaderKey,
  matchingImportLabel,
  suggestImportLabel,
  textImportHeaders,
} from '@core/songs';

/**
 * Which 이름표 each bracket heading of an imported text becomes. Headings
 * that name a 이름표 take it at once; the others are offered in the mapping
 * dialog with a suggestion, until it is applied or kept as written.
 */
export function useImportLabelMapping(text: string, labels: readonly Label[]) {
  const headers = useMemo(() => textImportHeaders(text), [text]);
  const exact = useMemo(
    () =>
      new Map(
        headers.map(header => [
          importHeaderKey(header.name),
          matchingImportLabel(header.name, labels)?.name ?? header.name,
        ]),
      ),
    [headers, labels],
  );
  const [requested, setRequested] = useState(true);
  const [edits, setEdits] = useState<ReadonlyMap<string, string>>(new Map());
  const [applied, setApplied] = useState<ReadonlyMap<string, string> | null>(
    null,
  );
  const suggestions = useMemo(
    () =>
      new Map(
        headers.map(header => [
          importHeaderKey(header.name),
          suggestImportLabel(header.name, labels),
        ]),
      ),
    [headers, labels],
  );
  const choices = useMemo(
    () => new Map([...suggestions, ...edits]),
    [suggestions, edits],
  );
  const chosen = useMemo(
    () =>
      new Map(
        [...choices].map(([key, value]) => [
          key,
          matchingImportLabel(value, labels)?.name ?? value.trim(),
        ]),
      ),
    [choices, labels],
  );
  return {
    headers,
    /** The 이름표 each heading becomes in the slides now. */
    inUse: applied ?? exact,
    /** What the dialog shows for each heading. */
    choices,
    /** The choices as 이름표 names, which 적용 would make current. */
    chosen,
    /** Some heading names no 이름표, and the dialog was not answered yet. */
    asking:
      requested &&
      headers.some(
        header => matchingImportLabel(header.name, labels) === undefined,
      ),
    change: useCallback((key: string, value: string) => {
      setEdits(current => new Map(current).set(key, value));
    }, []),
    /** Asks again, as when 이름표 인식 is turned on. */
    ask: (): void => setRequested(true),
    apply: (): void => {
      setApplied(chosen);
      setEdits(chosen);
      setRequested(false);
    },
    /** Keeps every heading as written. */
    keep: (): void => {
      setApplied(new Map());
      setRequested(false);
    },
  };
}
