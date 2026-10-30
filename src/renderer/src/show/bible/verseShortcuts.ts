import {useLive} from '@renderer/state/live';
import {outputTile, useShow} from '@renderer/state/show';
import {
  bibleSourceFor,
  liveTileIndex,
  tilesForView,
} from '@renderer/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/state/showOutput';
import {openBiblePassage} from './actions';
import type {VerseDirection} from './adjacentVerses';
import {lookupAdjacentPassage} from './lookupAdjacentPassage';

/** Adds and outputs an endpoint of the open passage when it contains the live verse. */
export async function outputAdjacentBibleVerse(
  direction: VerseDirection,
): Promise<void> {
  const api = window.llp;
  const initial = useShow.getState();
  const slide = useLive.getState().state?.layers.slide ?? null;
  const itemId = initial.openItemId;
  if (!api || itemId === null || liveTileIndex(initial, slide) === null) return;
  const source = bibleSourceFor(initial, itemId);
  const row = initial.rows.find(candidate => candidate.id === itemId);
  const passage =
    source?.passage ?? (row?.kind === 'bible' ? row.bible : undefined);
  if (!passage) return;
  const count = tilesForView(initial, itemId).length;
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
