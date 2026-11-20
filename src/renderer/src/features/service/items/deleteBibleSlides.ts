import {normalizeVerse} from '@core/bible/split/manualSplit';
import {cacheKey} from '@core/bible/split/splitCache';
import {pinVerseParts, type VersePart} from '@core/bible/split/splitVerses';
import {textSlideKey, textVerseKey} from '@core/presentation/textOverrides';
import {
  deletedBibleSlidesSchema,
  pinnedBibleVersesSchema,
} from '@core/schema/biblePassage';
import {parsePayload} from '@core/schema/payload';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import type {ShowTile} from '@core/schema/showService';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {useShow} from '@renderer/session/show';
import type {ServiceItemStore} from './serviceItemStore';

/** Persists a set of removed occurrences and the original boundaries of the affected verses. */
export async function deleteBibleSlides({
  items,
  serviceId,
  item,
  tiles,
  projection,
  removeCard,
}: {
  readonly items: ServiceItemStore;
  readonly serviceId: string;
  readonly item: ServiceItemOf<'bible' | 'sermon'>;
  readonly tiles: readonly ShowTile[];
  readonly projection: BibleProjection | null;
  readonly removeCard: boolean;
}): Promise<boolean> {
  const passage = isItemOfKind(item, 'bible')
    ? item.bible
    : item.sermon.passage;
  const view = useShow.getState();
  const row =
    view.serviceId === serviceId
      ? view.rows.find(row => row.id === item.id)
      : undefined;
  const lookup = row?.kind === 'bible' ? row.bible?.passage : undefined;
  const rawVerses = new Map(
    lookup?.verses.map(verse => [
      `${verse.chapter}:${verse.verse}`,
      verse.text,
    ]),
  );
  const measuredVerses = new Map(
    projection?.verses.map(verse => [
      textVerseKey(verse.reference),
      verse.text,
    ]),
  );
  const measuredParts = new Map<string, VersePart[]>();
  for (const part of projection?.parts ?? []) {
    const key = textVerseKey(part.reference);
    const existing = measuredParts.get(key);
    if (existing === undefined) measuredParts.set(key, [part]);
    else existing.push(part);
  }
  const removed = new Set<string>();
  const pins = new Map<
    string,
    {readonly cuts: string; readonly parts: readonly string[]}
  >();
  for (const tile of tiles) {
    const key = textSlideKey(tile);
    if (key === undefined) return false;
    removed.add(key);
    const reference = tile.bibleVerse;
    if (reference === undefined) continue;
    const pinKey = textVerseKey(reference);
    if (pins.has(pinKey)) continue;
    const verse = measuredVerses.get(pinKey);
    const raw =
      lookup?.translation === reference.translation &&
      tile.biblePart === undefined
        ? rawVerses.get(`${reference.chapter}:${reference.verse}`)
        : undefined;
    const parts =
      passage.pinnedVerses?.[pinKey] ??
      (verse !== undefined
        ? pinVerseParts(verse, measuredParts.get(pinKey) ?? [])
        : raw === undefined
          ? undefined
          : [normalizeVerse(raw)]);
    if (parts === undefined) return false;
    pins.set(pinKey, {cuts: cacheKey(reference), parts});
  }
  if (removed.size === 0 && !removeCard) return false;
  return items.submitItemEdit({
    target: {serviceId, itemId: item.id},
    failure: '슬라이드 삭제 실패',
    change: fresh => {
      if (!isItemOfKind(fresh, 'bible') && !isItemOfKind(fresh, 'sermon')) {
        return null;
      }
      const current = isItemOfKind(fresh, 'bible')
        ? fresh.bible
        : fresh.sermon.passage;
      if (
        current.ref !== passage.ref ||
        current.translation !== passage.translation
      ) {
        return null;
      }
      const pinnedVerses = {...current.pinnedVerses};
      for (const [key, {cuts, parts}] of pins) {
        if (
          JSON.stringify(current.cuts?.[cuts]) !==
            JSON.stringify(passage.cuts?.[cuts]) ||
          (pinnedVerses[key] !== undefined &&
            JSON.stringify(pinnedVerses[key]) !== JSON.stringify(parts))
        ) {
          return null;
        }
        pinnedVerses[key] = parts;
      }
      const deletedSlides = [
        ...new Set([...(current.deletedSlides ?? []), ...removed]),
      ];
      if (
        !parsePayload(deletedBibleSlidesSchema, deletedSlides).ok ||
        !parsePayload(pinnedBibleVersesSchema, pinnedVerses).ok
      ) {
        return null;
      }
      const next = {
        ...current,
        ...(pins.size === 0 ? {} : {pinnedVerses}),
        ...(removed.size === 0 ? {} : {deletedSlides}),
      };
      const updated = isItemOfKind(fresh, 'bible')
        ? {...fresh, bible: next}
        : {...fresh, sermon: {...fresh.sermon, passage: next}};
      if (!removeCard) return updated;
      const {sectionCard: _card, ...rest} = updated;
      return rest;
    },
  });
}
