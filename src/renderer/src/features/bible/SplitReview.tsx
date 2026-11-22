import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import {
  BIBLE_BOOKS,
  cutsOfVerse,
  type VerseInput,
  offsetsFromChunks,
  planSlides,
  planSlidesAtOffsets,
} from '@core/bible';
import type {BibleCutSelection} from '@core/schema/bibleCuts';
import type {BibleSplit} from './passageSplitter';
import {verseKey} from './BibleRefinements';
import {SplitEditor} from './SplitEditor';

function reviewPlan(
  projection: BibleSplit,
  verse: VerseInput,
  suggestion: readonly number[] | undefined,
) {
  const key = verseKey(verse.reference);
  const parts = projection.parts.filter(
    part => verseKey(part.reference) === key,
  );
  const prefix = projection.numbered ? `${verse.reference.verse} ` : '';
  const layout = {...projection.layout, prefix};
  const cuts = suggestion ?? cutsOfVerse(parts, verse.reference);
  const plan = planSlides(verse.text, cuts, layout);
  const sameParts =
    parts.length === plan.slides.length &&
    parts.every((part, index) => part.text === plan.slides[index]?.text);
  if (plan.ok && (suggestion !== undefined || sameParts)) return {cuts, plan};

  const offsets = offsetsFromChunks(verse.text, parts);
  const automatic =
    offsets === undefined
      ? null
      : planSlidesAtOffsets(verse.text, offsets, layout);
  if (automatic?.ok && offsets !== undefined) {
    return {cuts: automatic.cuts, plan: automatic, offsets};
  }
  return {cuts, plan};
}

/** Reads later pages from current results while the visible page keeps its own edits. */
export function SplitReview({
  projection,
  references,
  pending,
  suggestCuts,
  onConfirm,
  onComplete,
  onCancel,
}: {
  readonly projection: BibleSplit;
  readonly references: ReadonlyArray<VerseInput['reference']>;
  readonly pending: ReadonlySet<string>;
  readonly suggestCuts?:
    | ((verse: VerseInput, prefix: string) => readonly number[] | undefined)
    | undefined;
  readonly onConfirm: (
    verse: VerseInput,
    cut: {
      readonly selection: BibleCutSelection;
      readonly texts: readonly string[];
    },
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
        const prefix = projection.numbered ? `${reference.verse} ` : '';
        const prepared = pending.has(key)
          ? undefined
          : reviewPlan(projection, verse, suggestCuts?.(verse, prefix));
        return [{key, verse, prefix, prepared}];
      }),
    [references, projection, pending, suggestCuts],
  );
  const entry = queue[position];
  if (entry === undefined) return null;
  const reference = entry.verse.reference;
  return (
    <SplitEditor
      key={entry.key}
      verse={entry.verse}
      cuts={entry.prepared?.cuts ?? []}
      prefix={entry.prefix}
      label={`${BIBLE_BOOKS.find(book => book.id === reference.book)?.korean ?? '성경'} ${reference.chapter}:${reference.verse}`}
      layout={projection.layout}
      theme={projection.theme}
      address={projection.address}
      pending={pending.has(entry.key)}
      preparedPlan={entry.prepared?.plan}
      ruleBased={entry.prepared?.offsets !== undefined}
      position={position}
      total={queue.length}
      onCancel={onCancel}
      onConfirm={async (cuts, texts) => {
        const offsets = entry.prepared?.offsets;
        await onConfirm(entry.verse, {
          selection:
            offsets === undefined ? {cuts} : {cuts: offsets, unit: 'character'},
          texts,
        });
        if (!active.current) return;
        if (position + 1 < queue.length) setPosition(position + 1);
        else onComplete();
      }}
    />
  );
}
