import type {TileCursor} from '@core/presentation';
import {QUICK_BIBLE_TRANSITION} from '@core/bible';
import {useLive} from './live';
import {liveCursor, tilesOf} from './showCursor';
import {useShow} from './showStore';
import {bibleSourceFor, isLibrarySource} from './showLibrary';

interface ReturnPoint {
  readonly cursor: TileCursor;
  readonly serviceId: string | null;
  readonly slideId: string | undefined;
}
let previous: ReturnPoint | null = null;
let quickId: string | null = null;

function quickIsLive(): boolean {
  const id = useLive.getState().state?.layers.slide?.itemId;
  if (!id || quickId === null) return false;
  if (id === quickId) return true;
  const source = bibleSourceFor(useShow.getState(), id);
  return (
    source !== null &&
    source.transition?.kind === QUICK_BIBLE_TRANSITION.kind &&
    source.transition.dir === QUICK_BIBLE_TRANSITION.dir &&
    source.transition.sec === QUICK_BIBLE_TRANSITION.sec
  );
}

/** Captures the live cursor before quick output, preserving it across quick passages. */
export function beginQuickPassage(): void {
  if (quickIsLive()) return;
  const cursor = liveCursor();
  const view = useShow.getState();
  previous =
    cursor === null
      ? null
      : {
          cursor,
          serviceId: view.serviceId,
          slideId: tilesOf(cursor.itemId)[cursor.index]?.slide.id,
        };
  quickId = null;
}

export function finishQuickPassage(): void {
  quickId = useShow.getState().openItemId;
}

/** Where to go back to after the quick passage, if anywhere. */
export function quickReturnCursor(): TileCursor | null {
  if (!quickIsLive() || previous === null) return null;
  const view = useShow.getState();
  const {cursor, serviceId, slideId} = previous;
  const exists =
    view.rows.some(row => row.kind !== 'header' && row.id === cursor.itemId) ||
    isLibrarySource(view, cursor.itemId) ||
    bibleSourceFor(view, cursor.itemId) !== null;
  if (
    !exists ||
    (view.serviceId !== serviceId && !isLibrarySource(view, cursor.itemId))
  ) {
    return null;
  }
  const tiles = tilesOf(cursor.itemId);
  const index =
    slideId === undefined
      ? cursor.index
      : tiles.findIndex(tile => tile.slide.id === slideId);
  return index >= 0 && index < tiles.length
    ? {itemId: cursor.itemId, index}
    : null;
}

export function canReturnFromQuickPassage(): boolean {
  return quickReturnCursor() !== null;
}

/** Forgets the quick passage and what was on output before it. */
export function forgetQuickPassage(): void {
  previous = null;
  quickId = null;
}
