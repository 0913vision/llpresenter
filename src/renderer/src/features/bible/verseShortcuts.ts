import {useLive} from '@renderer/platform/live';
import {outputTile, useShow} from '@renderer/features/presentation/state/show';
import {
  bibleSourceFor,
  liveTileIndex,
  tilesForView,
} from '@renderer/features/presentation/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/features/presentation/state/showOutput';
import {openBiblePassage} from './actions';
import type {VerseDirection} from '@core/bible/adjacentVerses';
import {lookupAdjacentPassage} from './lookupAdjacentPassage';

/**
 * Outputs the verse beside the live one in the open passage. On the passage's
 * first or last verse, it adds the adjacent verse to the passage first, so no
 * verse is skipped (user decision, October 30).
 */
export async function outputAdjacentBibleVerse(
  direction: VerseDirection,
): Promise<void> {
  const api = window.llp;
  const initial = useShow.getState();
  const slide = useLive.getState().state?.layers.slide ?? null;
  const itemId = initial.openItemId;
  const liveIndex = liveTileIndex(initial, slide);
  if (!api || itemId === null || liveIndex === null) return;
  const count = tilesForView(initial, itemId).length;
  const beside = direction === 'previous' ? liveIndex - 1 : liveIndex + 1;
  if (beside >= 0 && beside < count) {
    outputTile({itemId, index: beside});
    return;
  }
  const source = bibleSourceFor(initial, itemId);
  const row = initial.rows.find(candidate => candidate.id === itemId);
  const passage =
    source?.passage ?? (row?.kind === 'bible' ? row.bible : undefined);
  if (!passage) return;
  const request = beginOutputRequest();
  const commandVersion = useLive.getState().commandVersion;
  const current = (): boolean => {
    const view = useShow.getState();
    const live = useLive.getState().state?.layers.slide;
    return (
      isOutputRequestCurrent(request, commandVersion) &&
      view.serviceId === initial.serviceId &&
      view.openItemId === itemId &&
      view.selectedTile === initial.selectedTile &&
      bibleSourceFor(view, itemId) === source &&
      (source !== null || view.rows === initial.rows) &&
      live?.itemId === slide?.itemId &&
      live?.position === slide?.position
    );
  };
  try {
    const expanded = await lookupAdjacentPassage({
      passage,
      direction,
      lookup: request => api.bible.lookup(request),
      current,
    });
    if (!current() || expanded === null) return;
    openBiblePassage(expanded, {
      verseNumbers:
        source?.verseNumbers ??
        (row?.kind === 'bible' ? row.bible?.verseNumbers : undefined) ??
        true,
      enteredRef: source?.enteredRef ?? passage.ref,
      enteredTranslation: source?.enteredTranslation ?? passage.translation,
    });
    if (expanded.verses.length <= count) return;
    const id = useShow.getState().openItemId;
    if (id !== null) {
      outputTile({
        itemId: id,
        index: direction === 'previous' ? 0 : expanded.verses.length - 1,
      });
    }
  } catch (cause) {
    if (current()) {
      api.log.write({
        level: 'error',
        message: 'Could not output an adjacent Bible verse',
        detail: String(cause),
      });
    }
  }
}
