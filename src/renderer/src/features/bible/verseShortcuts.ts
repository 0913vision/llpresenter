import type {VerseDirection} from '@core/bible';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {useLive} from '@renderer/session/live';
import {outputTile, useShow} from '@renderer/session/show';
import {
  bibleSourceFor,
  liveTileIndex,
  tilesForView,
} from '@renderer/session/showLibrary';
import type {ShowView} from '@renderer/session/showStore';
import {
  bibleSource,
  type BibleDisplay,
  type BibleSource,
} from '@renderer/session/bibleSource';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/showOutput';
import {openBiblePassage} from './actions';
import {lookupAdjacentPassage} from './lookupAdjacentPassage';
import {passageText} from './passageText';

/** The passage an item shows, as if it had been opened by itself. */
async function openedPassage(
  view: ShowView,
  itemId: string,
): Promise<BibleSource | null> {
  const source = bibleSourceFor(view, itemId);
  if (source !== null) return source;
  const row = view.rows.find(entry => entry.id === itemId);
  const passage: BiblePassage | undefined =
    row !== undefined && 'passage' in row ? row.passage : undefined;
  if (passage === undefined) return null;
  const text = await passageText(passage);
  if (text === null) return null;
  return bibleSource(`bible:${crypto.randomUUID()}`, text, {
    verseNumbers: passage.verseNumbers,
    translationName: passage.translationName,
    transition: passage.transition,
    enteredRef: passage.ref,
    enteredTranslation: passage.translation,
    slides: tilesForView(view, itemId).flatMap(tile =>
      tile.slide.verse === undefined ? [] : [tile.slide],
    ),
  });
}

/** The slide that shows the verse a passage grew by, on its own side. */
function edgeIndex(
  source: BibleSource,
  passage: BibleLookupPassage,
  direction: VerseDirection,
): number {
  const edge = passage.verses.at(direction === 'previous' ? 0 : -1);
  return source.tiles.findIndex(
    ({slide}) =>
      slide.verse !== undefined &&
      slide.verse.chapter === edge?.chapter &&
      slide.verse.verse === edge.verse,
  );
}

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
  const tiles = tilesForView(initial, itemId);
  const beside = direction === 'previous' ? liveIndex - 1 : liveIndex + 1;
  if (tiles[liveIndex]?.slide.verse === undefined) {
    if (tiles[beside] !== undefined) outputTile({itemId, index: beside});
    return;
  }
  if (tiles[beside]?.slide.verse !== undefined) {
    outputTile({itemId, index: beside});
    return;
  }
  const request = beginOutputRequest();
  const commandVersion = useLive.getState().commandVersion;
  const current = (): boolean => {
    const view = useShow.getState();
    const live = useLive.getState().state?.layers.slide;
    return (
      isOutputRequestCurrent(request, commandVersion) &&
      view.serviceId === initial.serviceId &&
      view.openItemId === itemId &&
      live?.itemId === slide?.itemId &&
      live?.slideId === slide?.slideId
    );
  };
  try {
    const source = await openedPassage(initial, itemId);
    if (source === null || !current()) return;
    const expanded = await lookupAdjacentPassage({
      passage: source.passage,
      direction,
      lookup: request => api.bible.lookup(request),
      current,
    });
    if (!current() || expanded === null) return;
    const display: BibleDisplay = {
      verseNumbers: source.verseNumbers,
      translationName: source.translationName,
      transition: source.transition,
      review: false,
      enteredRef: source.enteredRef ?? source.passage.ref,
      enteredTranslation:
        source.enteredTranslation ?? source.passage.translation,
    };
    const opened = openBiblePassage(expanded, display, {
      before: source,
    });
    outputTile({
      itemId: opened.id,
      index: Math.max(0, edgeIndex(opened, expanded, direction)),
    });
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
