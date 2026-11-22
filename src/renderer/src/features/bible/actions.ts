import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {cutBy} from '@core/bible/split/splitPassage';
import {passageSlides} from '@core/slides/passageSlides';
import {slideMaking} from '@renderer/platform/themes';
import {
  bibleSource,
  type BibleDisplay,
  type BibleSource,
} from '@renderer/session/bibleSource';
import {useLive} from '@renderer/session/live';
import {outputTile, useShow} from '@renderer/session/show';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {bibleSourceFor, withBibleSource} from '@renderer/session/showLibrary';
import {passageSplitter} from './passageSplitter';

function samePassage(
  first: BibleLookupPassage,
  second: BibleLookupPassage,
): boolean {
  return first.ref === second.ref && first.translation === second.translation;
}

/** Whether a passage shows verses of another one the same way. */
function goesOnFrom(
  opened: BibleSource | null,
  passage: BibleLookupPassage,
  display: BibleDisplay,
): opened is BibleSource {
  return (
    opened !== null &&
    opened.passage.translation === passage.translation &&
    opened.verseNumbers === display.verseNumbers &&
    (opened.translationName ?? false) === (display.translationName ?? false) &&
    opened.passage.verses.some(verse =>
      passage.verses.some(
        other => other.chapter === verse.chapter && other.verse === verse.verse,
      ),
    )
  );
}

/** Makes the slides of a passage, with the ones its verses had already. */
function sourceOf(
  passage: BibleLookupPassage,
  display: BibleDisplay,
  opened: BibleSource | null,
): BibleSource {
  const kept = goesOnFrom(opened, passage, display) ? opened : null;
  const {verseNumbers, translationName = false, transition} = display;
  const before = kept?.slides ?? [];
  const split = passageSplitter()?.split(passage, {
    verseNumbers,
    slides: before,
  });
  const slides = passageSlides(slideMaking(), {
    passage,
    settings: {verseNumbers, translationName},
    cut: split == null ? text => [text] : cutBy(split),
    before,
  }).map(slide =>
    transition === undefined || before.includes(slide)
      ? slide
      : {...slide, transition},
  );
  return bibleSource(kept?.id ?? `bible:${crypto.randomUUID()}`, passage, {
    ...display,
    slides,
  });
}

/** Opens a passage, cut to fit the 말씀 theme, without sending it out. */
export function openBiblePassage(
  passage: BibleLookupPassage,
  display: BibleDisplay = {verseNumbers: true},
  before?: BibleSource,
): BibleSource {
  const view = useShow.getState();
  const opened = before ?? bibleSourceFor(view, view.openItemId);
  const source = sourceOf(passage, display, opened);
  const insertion =
    opened?.insertion?.serviceId === view.serviceId
      ? opened.insertion
      : {serviceId: view.serviceId, itemId: view.openItemId};
  const selected = opened?.tiles[view.selectedTile]?.slide.id;
  beginOutputRequest();
  useShow.setState({
    bibleSources: withBibleSource(
      view,
      {...source, insertion},
      useLive.getState().state?.layers.slide?.itemId ?? null,
    ),
    openItemId: source.id,
    selectedTile: Math.max(
      0,
      source.tiles.findIndex(tile => tile.slide.id === selected),
    ),
  });
  return source;
}

/** Outputs the selected slide of a passage like any other slide. */
export function showBiblePassage(
  passage: BibleLookupPassage,
  display?: BibleDisplay,
): void {
  const view = useShow.getState();
  const prepared = bibleSourceFor(view, view.openItemId);
  const own =
    display ??
    (prepared !== null && samePassage(prepared.passage, passage)
      ? prepared
      : undefined);
  const source =
    prepared !== null && own === prepared
      ? prepared
      : openBiblePassage(passage, {
          ...own,
          verseNumbers: own?.verseNumbers ?? true,
          review: own?.review ?? true,
        });
  outputTile({itemId: source.id, index: useShow.getState().selectedTile});
}
