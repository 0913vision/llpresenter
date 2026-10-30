import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {outputTile, useShow} from '@renderer/session/show';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {
  bibleSource,
  type BibleDisplayOptions,
  type BiblePreviewOptions,
} from '@core/bible/source';

function samePassage(
  first: BibleLookupPassage,
  second: BibleLookupPassage,
): boolean {
  return first.ref === second.ref && first.translation === second.translation;
}

export function openBiblePassage(
  passage: BibleLookupPassage,
  options?: BiblePreviewOptions,
): void {
  const source = bibleSource(passage, options);
  const view = useShow.getState();
  const live = useLive.getState();
  const liveItemId = live.state?.layers.slide?.itemId ?? null;
  const liveBibleSource = bibleSourceFor(view, liveItemId);
  const previous = bibleSourceFor(view, view.openItemId);
  const insertion =
    previous?.insertion?.serviceId === view.serviceId
      ? previous.insertion
      : {serviceId: view.serviceId, itemId: view.openItemId};
  beginOutputRequest();
  useShow.setState({
    bibleSource: {...source, insertion},
    liveBibleSource,
    requestedBibleSource:
      view.requestedBibleSource?.id === liveItemId
        ? null
        : view.requestedBibleSource,
    openItemId: source.id,
    selectedTile:
      previous !== null && samePassage(previous.passage, passage)
        ? Math.min(view.selectedTile, source.tiles.length - 1)
        : 0,
  });
}

/** Outputs the selected Bible tile through the standard slide command path. */
export function showBiblePassage(
  passage: BibleLookupPassage,
  options?: BibleDisplayOptions,
): void {
  const current = useShow.getState();
  const prepared = bibleSourceFor(current, current.openItemId);
  const display =
    options ??
    (prepared !== null && samePassage(prepared.passage, passage)
      ? {
          verseNumbers: prepared.verseNumbers,
          enteredRef: prepared.enteredRef,
          enteredTranslation: prepared.enteredTranslation,
        }
      : undefined);
  openBiblePassage(passage, display);
  const view = useShow.getState();
  if (view.openItemId !== null) {
    outputTile({itemId: view.openItemId, index: view.selectedTile});
  }
}
