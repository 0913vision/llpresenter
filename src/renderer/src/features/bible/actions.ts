import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {outputTile, useShow} from '@renderer/session/show';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/showOutput';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor, tilesForView} from '@renderer/session/showLibrary';
import {bibleSource, type BiblePreviewOptions} from '@core/bible/source';
import {retainedBibleSelection} from '@core/bible/selection';

type ReviewHandler = (sourceId: string, output: () => void) => boolean;
let reviewHandler: ReviewHandler | null = null;

export function installBibleReviewHandler(handler: ReviewHandler): () => void {
  reviewHandler = handler;
  return () => {
    if (reviewHandler === handler) reviewHandler = null;
  };
}

function samePassage(
  first: BibleLookupPassage,
  second: BibleLookupPassage,
): boolean {
  return first.ref === second.ref && first.translation === second.translation;
}

export function openBiblePassage(
  passage: BibleLookupPassage,
  options?: BiblePreviewOptions,
  {
    ready = false,
    waitForLive = false,
  }: {readonly ready?: boolean; readonly waitForLive?: boolean} = {},
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
  const readyPassage =
    ready && waitForLive
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
    readyItemId: ready ? source.id : null,
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
  ready = false,
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
  openBiblePassage(
    passage,
    {
      ...display,
      verseNumbers: display?.verseNumbers ?? true,
      review: display?.review ?? true,
    },
    {ready, waitForLive: ready},
  );
  const view = useShow.getState();
  if (view.openItemId !== null) {
    const id = view.openItemId;
    const request = beginOutputRequest();
    const version = useLive.getState().commandVersion;
    const output = (): void => {
      const current = useShow.getState();
      if (
        current.openItemId === id &&
        isOutputRequestCurrent(request, version)
      ) {
        outputTile({itemId: id, index: current.selectedTile});
      }
    };
    if (reviewHandler?.(id, output) !== true) output();
  }
}
