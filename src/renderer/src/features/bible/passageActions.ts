import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {Slide} from '@core/schema/slides/slide';
import {
  bibleSource,
  type BibleDisplay,
  type BibleSource,
} from '@renderer/session/show/bibleSource';
import {useLive} from '@renderer/session/live';
import {outputTile} from '@renderer/session/show/show';
import {beginOutputRequest} from '@renderer/session/show/showOutput';
import {
  bibleSourceFor,
  withBibleSource,
} from '@renderer/session/show/showLibrary';
import {measurePassage, slidesOfPassage} from './makePassageSlides';
import {useShow} from '@renderer/session/show/showStore';

function samePassage(
  first: BibleLookupPassage,
  second: BibleLookupPassage,
): boolean {
  return first.ref === second.ref && first.translation === second.translation;
}

/** Whether a passage shows every verse of another one, the same way. */
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
    opened.passage.verses.every(verse =>
      passage.verses.some(
        other => other.chapter === verse.chapter && other.verse === verse.verse,
      ),
    )
  );
}

/** What a passage is cut with when it opens now: its numbers and the slides kept. */
function cutWith(
  passage: BibleLookupPassage,
  display: BibleDisplay,
  opened: BibleSource | null,
) {
  const kept = goesOnFrom(opened, passage, display) ? opened : null;
  const {verseNumbers, translationName = false} = display;
  return {kept, settings: {verseNumbers, translationName}};
}

/**
 * Cuts a passage ahead, as opening it would, so its slides are ready when the
 * operator presses Enter; nothing opens or goes out.
 */
export function preparePassage(
  passage: BibleLookupPassage,
  display: BibleDisplay,
): void {
  const view = useShow.getState();
  const {kept, settings} = cutWith(
    passage,
    display,
    bibleSourceFor(view, view.openItemId),
  );
  measurePassage(passage, settings, kept?.slides ?? []);
}

/** Makes the slides of a passage, with the ones its verses had already. */
function sourceOf(
  passage: BibleLookupPassage,
  display: BibleDisplay,
  opened: BibleSource | null,
): BibleSource {
  const {kept, settings} = cutWith(passage, display, opened);
  const {transition} = display;
  const before = kept?.slides ?? [];
  const slides = slidesOfPassage(
    passage,
    measurePassage(passage, settings, before),
    {settings, before},
  ).map(slide =>
    transition === undefined || before.includes(slide)
      ? slide
      : {...slide, transition},
  );
  return bibleSource(kept?.id ?? `bible:${crypto.randomUUID()}`, passage, {
    ...display,
    slides,
  });
}

/** The tile of a slide, or of its verse or the next one that is there. */
function tileOf({tiles}: BibleSource, slide: Slide | undefined): number {
  const own = tiles.findIndex(tile => tile.slide.id === slide?.id);
  const verse = slide?.verse;
  if (own >= 0 || verse === undefined) return Math.max(0, own);
  const next = tiles.findIndex(
    tile =>
      tile.slide.verse !== undefined &&
      (tile.slide.verse.chapter > verse.chapter ||
        (tile.slide.verse.chapter === verse.chapter &&
          tile.slide.verse.verse >= verse.verse)),
  );
  return next < 0 ? Math.max(0, tiles.length - 1) : next;
}

/** Opens a passage, cut to fit the 말씀 theme, without sending it out. */
export function openBiblePassage(
  passage: BibleLookupPassage,
  display: BibleDisplay = {verseNumbers: true},
  {
    before,
    keepsVerse = false,
  }: {
    /** The passage it grows from, instead of the one that is open. */
    readonly before?: BibleSource | undefined;
    /** Stays at the selected verse although the passage is another one. */
    readonly keepsVerse?: boolean;
  } = {},
): BibleSource {
  const view = useShow.getState();
  const opened = before ?? bibleSourceFor(view, view.openItemId);
  const source = sourceOf(passage, display, opened);
  const stays =
    opened !== null && (keepsVerse || samePassage(opened.passage, passage));
  beginOutputRequest();
  useShow.setState({
    bibleSources: withBibleSource(
      view,
      source,
      useLive.getState().state?.layers.slide?.itemId ?? null,
    ),
    openItemId: source.id,
    selectedTile: stays
      ? tileOf(source, opened.tiles[view.selectedTile]?.slide)
      : 0,
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
