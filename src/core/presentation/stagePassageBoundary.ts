import type {SlideTile} from './model';

/** Identifies passage and sermon-title boundaries that hide stage cues. */
export function stagePassageBoundary({
  tiles,
  index,
  passage,
  legacyTitleBeforePassage = false,
}: {
  readonly tiles: readonly SlideTile[];
  readonly index: number;
  readonly passage: boolean;
  readonly legacyTitleBeforePassage?: boolean;
}): boolean {
  const current = tiles[index];
  const next = tiles[index + 1];
  if (current === undefined) return false;
  if (legacyTitleBeforePassage && next === undefined) return true;
  if (!passage || current.sectionCard !== undefined) return false;
  if (current.sermonTitle === true) {
    return next !== undefined && next.sermonTitle !== true;
  }
  return next === undefined || next.sermonTitle === true;
}
