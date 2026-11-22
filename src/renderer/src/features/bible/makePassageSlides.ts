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
import {passageSplitter} from './passageSplitter';
import {reviewBibleInsertion} from './reviewBibleInsertion';

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
    readonly settings: Pick<BiblePassage, 'verseNumbers' | 'translationName'>;
    /** Slides some of the verses have already. */
    readonly before?: readonly Slide[];
    /** Keeps the address on every slide, for an item of no passage. */
    readonly ownAddress?: boolean;
  },
): Promise<readonly Slide[] | null> {
  const split = passageSplitter()?.split(passage, {
    verseNumbers: settings.verseNumbers,
    slides: before,
  });
  if (split == null) throw new Error('절 나누기를 측정할 수 없음');
  const references = versesToReview(split.parts);
  const asks =
    references.length > 0 &&
    (await api.preferences.get()).bible.splitEditorAutoOpen;
  const reviewed = asks
    ? await reviewBibleInsertion({projection: split, references})
    : {};
  if (reviewed === null) return null;
  const automatic = cutBy(split);
  const cut: CutVerse = (text, verse) =>
    reviewed[verseKey(verse)] ?? automatic(text, verse);
  return passageSlides(slideMaking(), {
    passage,
    settings,
    cut,
    before,
    ...(ownAddress ? {address: passageAddress(passage)} : {}),
  });
}
