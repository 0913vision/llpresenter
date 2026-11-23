import {
  cutBy,
  passageAddress,
  passageSlides,
  verseKey,
  type CutVerse,
} from '@core/slides';
import {versesToReview} from '@core/bible';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {Slide} from '@core/schema/slide';
import type {LlpApi} from '@contracts/ipc/api';
import {slideMaking} from '@renderer/platform/themes';
import {passageSplitter, type BibleSplit} from './passageSplitter';
import {reviewBibleInsertion} from './reviewBibleInsertion';

type Settings = Pick<BiblePassage, 'verseNumbers' | 'translationName'>;

/**
 * Cuts a passage for the text box of the 말씀 theme, keeping the slides some
 * verses have already. Null while nothing can measure the theme.
 */
export function measurePassage(
  passage: BibleLookupPassage,
  settings: Settings,
  before: readonly Slide[],
): BibleSplit | null {
  return (
    passageSplitter()?.split(passage, {
      verseNumbers: settings.verseNumbers,
      slides: before,
    }) ?? null
  );
}

/**
 * The slides of a passage, cut as `split` measured or a verse to a slide
 * without it; `reviewed` holds the cuts the operator chose for some verses.
 */
export function slidesOfPassage(
  passage: BibleLookupPassage,
  split: BibleSplit | null,
  {
    settings,
    before = [],
    reviewed = {},
    ownAddress = false,
  }: {
    readonly settings: Settings;
    readonly before?: readonly Slide[];
    readonly reviewed?: Readonly<Record<string, readonly string[]>>;
    /** Keeps the address on every slide, for an item of no passage. */
    readonly ownAddress?: boolean;
  },
): readonly Slide[] {
  const automatic: CutVerse = split === null ? text => [text] : cutBy(split);
  return passageSlides(slideMaking(), {
    passage,
    settings,
    cut: (text, verse) => reviewed[verseKey(verse)] ?? automatic(text, verse),
    before,
    ...(ownAddress ? {address: passageAddress(passage)} : {}),
  });
}

/**
 * The slides of a passage, after its long verses were looked over. Null when
 * the operator left that.
 */
export async function makePassageSlides(
  api: Pick<LlpApi, 'preferences'>,
  passage: BibleLookupPassage,
  {
    settings,
    before = [],
    ownAddress = false,
  }: {
    readonly settings: Settings;
    /** Slides some of the verses have already. */
    readonly before?: readonly Slide[];
    /** Keeps the address on every slide, for an item of no passage. */
    readonly ownAddress?: boolean;
  },
): Promise<readonly Slide[] | null> {
  const split = measurePassage(passage, settings, before);
  if (split === null) throw new Error('절 나누기를 측정할 수 없음');
  const references = versesToReview(split.parts);
  const asks =
    references.length > 0 &&
    (await api.preferences.get()).bible.splitEditorAutoOpen;
  const reviewed = asks
    ? await reviewBibleInsertion({projection: split, references})
    : {};
  if (reviewed === null) return null;
  return slidesOfPassage(passage, split, {
    settings,
    before,
    reviewed,
    ownAddress,
  });
}
