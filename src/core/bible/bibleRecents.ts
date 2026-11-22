import type {RecentPassage} from '@core/schema/bible';
import {parseReference} from './reference';

export const RECENT_PASSAGE_LIMIT = 10;

function passageKey(item: RecentPassage): string {
  const parsed = parseReference(item.ref);
  if (!parsed.ok) return JSON.stringify([item.translation, item.ref]);
  const {book, chapter, verse, endChapter, endVerse} = parsed.value;
  return JSON.stringify([
    item.translation,
    book.id,
    chapter,
    verse,
    endChapter,
    endVerse,
  ]);
}

/** Bounds stored history on read, retaining its newest occurrence of each pair. */
export function recentPassages(
  previous: Iterable<RecentPassage>,
): readonly RecentPassage[] {
  const result: RecentPassage[] = [];
  const seen = new Set<string>();
  for (const item of previous) {
    if (result.length === RECENT_PASSAGE_LIMIT) break;
    const key = passageKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Call after output or insertion, then persist the returned list in bible.json. */
export function rememberPassage(
  previous: readonly RecentPassage[],
  passage: RecentPassage,
): readonly RecentPassage[] {
  const key = passageKey(passage);
  const existing = previous.find(item => passageKey(item) === key);
  function* promoted(): Generator<RecentPassage> {
    yield {...existing, ref: passage.ref, translation: passage.translation};
    yield* previous;
  }
  return recentPassages(promoted());
}
