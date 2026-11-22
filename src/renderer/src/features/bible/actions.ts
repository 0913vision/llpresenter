import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {outputTile, useShow} from '@renderer/session/show';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor, tilesForView} from '@renderer/session/showLibrary';
import {bibleSource, type BiblePreviewOptions} from '@core/bible/source';
import {retainedBibleSelection} from '@core/bible/selection';
import {slidesOfParts} from '@core/bible/split/splitPassage';
import {passageSplitter} from './passageSplitter';

function samePassage(
  first: BibleLookupPassage,
  second: BibleLookupPassage,
): boolean {
  return first.ref === second.ref && first.translation === second.translation;
}

/** Opens a passage, cut to fit the 말씀 theme, without sending it out. */
export function openBiblePassage(
  passage: BibleLookupPassage,
  options: BiblePreviewOptions = {verseNumbers: true},
  {waitForLive = false}: {readonly waitForLive?: boolean} = {},
): void {
  const view = useShow.getState();
  const opened = bibleSourceFor(view, view.openItemId);
  // NOTE(0913vision): A longer passage keeps the slides of the verses it had.
  const slides =
    opened?.passage.translation === passage.translation
      ? opened.slides
      : undefined;
  const split = passageSplitter()?.split(passage, {
    verseNumbers: options.verseNumbers,
    slides,
    source: 'external',
  });
  const source = bibleSource(passage, {
    ...options,
    slides:
      split == null
        ? undefined
        : slidesOfParts(split.parts, {
            slides,
            transition: options.transition,
          }),
  });
  const live = useLive.getState();
  const liveItemId = live.state?.layers.slide?.itemId ?? null;
  const liveBibleSource = bibleSourceFor(view, liveItemId);
  const previous = bibleSourceFor(view, view.openItemId);
  const insertion =
    previous?.insertion?.serviceId === view.serviceId
      ? previous.insertion
      : {serviceId: view.serviceId, itemId: view.openItemId};
  beginOutputRequest();
  const readyPassage = waitForLive
    ? {
        id: source.id,
        previous: view.openItemId,
        previousSource: previous,
        title: passage.displayRef,
      }
    : null;
  const next = {
    bibleSource: {...source, insertion},
    liveBibleSource,
    requestedBibleSource:
      view.requestedBibleSource?.id === liveItemId
        ? null
        : view.requestedBibleSource,
    openItemId: source.id,
    readyItemId: source.id,
    readyPassage,
  };
  const nextTiles = tilesForView({...view, ...next}, source.id);
  useShow.setState({
    ...next,
    selectedTile:
      previous !== null && samePassage(previous.passage, passage)
        ? retainedBibleSelection(
            tilesForView(view, previous.id),
            view.selectedTile,
            nextTiles,
          )
        : 0,
  });
  if (readyPassage !== null) {
    setTimeout(() => {
      if (useShow.getState().readyPassage === readyPassage) {
        useShow.setState({readyPassage: null});
      }
    }, 1000);
  }
}

/** Outputs the selected Bible tile through the standard slide command path. */
export function showBiblePassage(
  passage: BibleLookupPassage,
  options?: BiblePreviewOptions,
): void {
  const current = useShow.getState();
  const prepared = bibleSourceFor(current, current.openItemId);
  const display =
    options ??
    (prepared !== null && samePassage(prepared.passage, passage)
      ? {
          verseNumbers: prepared.verseNumbers,
          reference: prepared.reference,
          translationName: prepared.translationName,
          transition: prepared.transition,
          enteredRef: prepared.enteredRef,
          enteredTranslation: prepared.enteredTranslation,
          review: prepared.review,
        }
      : undefined);
  openBiblePassage(passage, {
    ...display,
    verseNumbers: display?.verseNumbers ?? true,
    review: display?.review ?? true,
  });
  const view = useShow.getState();
  if (view.openItemId !== null) {
    outputTile({itemId: view.openItemId, index: view.selectedTile});
  }
}
