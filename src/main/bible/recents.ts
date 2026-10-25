import type {RecentPassage} from '@shared/schema/bible';
import type {ResolvedPassage} from './reference';

export const RECENT_PASSAGE_LIMIT = 10;

/** Bounds stored history on read, retaining its newest occurrence of each pair. */
export function recentPassages(
  previous: readonly RecentPassage[],
): readonly RecentPassage[] {
  const result: RecentPassage[] = [];
  for (const item of previous) {
    if (result.length === RECENT_PASSAGE_LIMIT) break;
    if (
      !result.some(
        recent =>
          recent.ref === item.ref && recent.translation === item.translation,
      )
    ) {
      result.push(item);
    }
  }
  return result;
}

/** Call after output or insertion, then persist the returned list in bible.json. */
export function rememberPassage(
  previous: readonly RecentPassage[],
  passage: Pick<ResolvedPassage, 'ref' | 'translation'>,
): readonly RecentPassage[] {
  const existing = previous.find(
    item =>
      item.ref === passage.ref && item.translation === passage.translation,
  );
  return recentPassages([
    {...existing, ref: passage.ref, translation: passage.translation},
    ...previous,
  ]);
}
