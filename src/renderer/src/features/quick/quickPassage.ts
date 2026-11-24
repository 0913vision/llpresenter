import {QUICK_BIBLE_TRANSITION} from '@core/bible';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {
  BibleDisplay,
  BibleSource,
} from '@renderer/session/show/bibleSource';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {useShow} from '@renderer/session/show/show';
import {openBiblePassage} from '../bible/actions';

/** How quick run opens a passage: at once, with its own transition. */
export function quickDisplay(display: BibleDisplay): BibleDisplay {
  return {...display, review: false, transition: QUICK_BIBLE_TRANSITION};
}

/** The tile of a source that the entered passage starts with. */
export function firstVerseOf(
  {tiles}: BibleSource,
  {verses}: BibleLookupPassage,
): number {
  const [first] = verses;
  return Math.max(
    0,
    tiles.findIndex(
      ({slide}) =>
        slide.verse?.chapter === first?.chapter &&
        slide.verse?.verse === first?.verse,
    ),
  );
}

/**
 * Follows an edit of the quick field for the open passage: the field asks
 * for the passage the operator typed for it again, so that passage opens
 * again; otherwise the open passage forgets what was typed for it.
 */
export function followQuickEdit(
  equivalent: BibleLookupPassage | null,
  display: BibleDisplay | null,
): void {
  const view = useShow.getState();
  const source = bibleSourceFor(view, view.openItemId);
  if (source?.enteredRef === undefined) return;
  const typedAgain =
    equivalent !== null &&
    equivalent.ref === source.enteredRef &&
    (source.enteredTranslation ?? source.passage.translation) ===
      equivalent.translation;
  if (typedAgain && display !== null) {
    openBiblePassage(equivalent, quickDisplay(display));
    return;
  }
  useShow.setState({
    bibleSources: view.bibleSources.map(entry =>
      entry === source ? {...source, enteredRef: undefined} : entry,
    ),
  });
}
