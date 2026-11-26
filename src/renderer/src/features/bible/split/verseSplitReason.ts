import {isCutOfVerse, sameVerse, versesOfPassage} from '@core/slides';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {Slide, VerseReference} from '@core/schema/slides/slide';

/**
 * Why the verse of a slide can not be cut between its words now, or
 * undefined when it can: no Bible slide, a list that can not be edited, the
 * text still loading or missing, or a verse whose slides were typed over.
 */
export function verseSplitReason(
  deck: {readonly slides: readonly Slide[]; readonly readOnly: boolean} | null,
  verse: VerseReference | undefined,
  text: BibleLookupPassage | null,
): string | undefined {
  if (deck === null || verse === undefined) {
    return '말씀 슬라이드를 고르십시오.';
  }
  if (deck.readOnly) return '지금은 편집할 수 없습니다.';
  if (text === null) return '본문을 불러오는 중입니다.';
  const original = versesOfPassage(text).find(entry =>
    sameVerse(entry.reference, verse),
  );
  if (original === undefined) return '이 절의 본문을 찾을 수 없습니다.';
  return isCutOfVerse(deck.slides, original)
    ? undefined
    : '직접 고친 절은 여기서 나눌 수 없습니다.';
}
