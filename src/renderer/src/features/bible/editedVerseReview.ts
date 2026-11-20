import {
  bibleEditedVersesSchema,
  type BibleEditedVerse,
} from '@core/schema/biblePassage';
import {parsePayload} from '@core/schema/payload';
import {
  bibleSplitGap,
  remapBibleSplitPart,
  replaceBibleSplitGap,
  type BibleSplitGap,
} from '@core/bible/editedVerses';
import type {VersePart} from '@core/bible/split/splitVerses';
import {sameBibleVerse} from '@core/bible/selection';
import {cacheKey} from '@core/bible/split/splitCache';
import {CONT_MARKER} from '@core/bible/split/layout';
import type {BibleCutSelection} from '@core/schema/bibleCuts';
import {
  isItemOfKind,
  type ServiceItem,
  type VerseSlide,
} from '@core/schema/service';
import type {BibleProjection} from './splitProjection';

export interface EditedVerseReview {
  readonly gap: BibleSplitGap;
  readonly key: string;
  readonly parts: BibleEditedVerse;
  readonly projection: BibleProjection;
  readonly reference: VerseSlide['verse'];
}

export function editedVerseReview(
  source: BibleProjection,
  selected: VersePart,
): EditedVerseReview | undefined {
  const key = cacheKey(selected.reference);
  const parts = source.source.editedVerses?.[key];
  if (parts === undefined) return undefined;
  const gap = bibleSplitGap(parts, selected.part - 1);
  if (gap === undefined) return undefined;
  const reference = selected.reference;
  const fullLayout = source.layout;
  const layout =
    gap.end === parts.length
      ? fullLayout
      : {
          ...fullLayout,
          measure: (
            text: string,
            options: Parameters<typeof fullLayout.measure>[1],
          ) => fullLayout.measure(text, {...options, marker: CONT_MARKER}),
        };
  return {
    key,
    parts,
    gap,
    reference,
    projection: {
      ...source,
      layout,
      verses: [{reference, text: gap.text}],
      parts: source.parts
        .filter(part => sameBibleVerse(part.reference, reference))
        .slice(gap.start, gap.end),
      numbered: source.numbered && gap.start === 0,
    },
  };
}

export function applyEditedVerseReview(
  item: ServiceItem,
  review: EditedVerseReview,
  cuts: BibleCutSelection,
): ServiceItem | null {
  if (!isItemOfKind(item, 'bible') && !isItemOfKind(item, 'sermon')) {
    return null;
  }
  const passage = isItemOfKind(item, 'bible')
    ? item.bible
    : item.sermon.passage;
  const parts = passage.editedVerses?.[review.key];
  if (
    passage.translation !== review.reference.translation ||
    parts === undefined ||
    JSON.stringify(parts) !== JSON.stringify(review.parts)
  ) {
    return null;
  }
  const replacement = replaceBibleSplitGap(parts, review.gap, cuts);
  const editedVerses = {...passage.editedVerses, [review.key]: replacement};
  if (!parsePayload(bibleEditedVersesSchema, editedVerses).ok) return null;
  const remap = <
    T extends {readonly verse: VerseSlide['verse']; readonly part: number},
  >(
    entries: readonly T[],
  ): readonly T[] =>
    entries.flatMap(entry => {
      if (!sameBibleVerse(entry.verse, review.reference)) return [entry];
      const part = remapBibleSplitPart(
        entry.part,
        review.gap,
        cuts.cuts.length + 1,
      );
      return part === undefined ? [] : [{...entry, part}];
    });
  const updated = {
    ...item,
    ...(item.bibleLabels === undefined
      ? {}
      : {bibleLabels: remap(item.bibleLabels)}),
    ...(item.bibleTransitions === undefined
      ? {}
      : {bibleTransitions: remap(item.bibleTransitions)}),
  };
  const settings = {...passage, editedVerses};
  return isItemOfKind(updated, 'bible')
    ? {...updated, bible: settings}
    : {...updated, sermon: {...updated.sermon, passage: settings}};
}
