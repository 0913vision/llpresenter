import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {cutsOfVerse, type VerseInput} from '@core/bible/split/splitVerses';
import {planSlides} from '@core/bible/split/manualSplit';
import type {BibleProjection} from './splitProjection';
import {verseKey} from './BibleRefinements';
import {SplitEditor} from './SplitEditor';

/** Reads later pages from current results while the visible page keeps its own edits. */
export function SplitReview({
  projection,
  references,
  pending,
  onConfirm,
  onComplete,
  onCancel,
}: {
  readonly projection: BibleProjection;
  readonly references: ReadonlyArray<VerseInput['reference']>;
  readonly pending: ReadonlySet<string>;
  readonly onConfirm: (
    verse: VerseInput,
    cuts: readonly number[],
  ) => Promise<void>;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
}): JSX.Element | null {
  const [position, setPosition] = useState(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const queue = useMemo(
    () =>
      references.flatMap(reference => {
        const key = verseKey(reference);
        const verse = projection.verses.find(
          verse => verseKey(verse.reference) === key,
        );
        if (verse === undefined) return [];
        const cuts = cutsOfVerse(projection.parts, reference);
        const prefix = projection.numbered ? `${reference.verse} ` : '';
        const plan = pending.has(key)
          ? undefined
          : planSlides(verse.text, cuts, {...projection.layout, prefix});
        return [{key, verse, cuts, prefix, plan}];
      }),
    [references, projection, pending],
  );
  const entry = queue[position];
  if (entry === undefined) return null;
  const reference = entry.verse.reference;
  return (
    <SplitEditor
      key={entry.key}
      verse={entry.verse}
      cuts={entry.cuts}
      prefix={entry.prefix}
      label={`${BIBLE_BOOKS.find(book => book.id === reference.book)?.korean ?? '성경'} ${reference.chapter}:${reference.verse}`}
      layout={projection.layout}
      element={projection.element}
      appearance={projection.appearance}
      pending={pending.has(entry.key)}
      preparedPlan={entry.plan}
      position={position}
      total={queue.length}
      onCancel={onCancel}
      onConfirm={async cuts => {
        await onConfirm(entry.verse, cuts);
        if (!active.current) return;
        if (position + 1 < queue.length) setPosition(position + 1);
        else onComplete();
      }}
    />
  );
}
