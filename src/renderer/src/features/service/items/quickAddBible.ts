import {createServiceItemId} from '@core/schema/ids';
import type {Result} from '@core/common/result';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import type {ServiceItemOf} from '@core/schema/service';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {SlideTransition} from '@core/schema/slideTransition';
import {defaultSlideTransitions} from '@core/schema/preferences';
import {SHOW_SERVICE_LIMITS} from '@core/schema/showService';
import type {LlpApi} from '@contracts/ipc/api';
import {cutVerse} from '@core/services/passageEdits';
import {verseKey} from '@core/bible/bibleTiles';
import {slidesOfParts} from '@core/bible/split/splitPassage';
import {versesToReview} from '@core/bible/split/splitVerses';
import {useShow} from '@renderer/session/showStore';
import {passageSplitter} from '@renderer/features/bible/passageSplitter';
import {reviewBibleInsertion} from '@renderer/features/bible/reviewBibleInsertion';

interface PassageInsertion {
  readonly api: Pick<LlpApi, 'preferences'>;
  readonly serviceId: string;
  readonly sermonTitle?: string;
}

/** The 환경설정 values a new passage starts with; absent ones are the built-in ones. */
export interface PassageDefaults {
  readonly translation: BibleLookupReply['translation'];
  readonly verseNumbers: boolean;
  readonly reference?: BiblePassage['reference'];
  readonly translationName?: boolean;
  readonly transition?: BiblePassage['transition'] | undefined;
  readonly sermonTitleTransition?: SlideTransition | undefined;
  readonly passage?: BibleLookupPassage | undefined;
}

/** A passage item with the default settings of a new Bible item (spec 05). */
export function passageItem(
  ref: string,
  {
    translation,
    verseNumbers,
    reference = 'every',
    translationName = false,
    transition = defaultSlideTransitions.bible,
  }: PassageDefaults,
): ServiceItemOf<'bible'> {
  return {
    id: createServiceItemId(crypto.randomUUID()),
    bible: {
      translation,
      ref,
      split: 'verse',
      reference,
      verseNumbers,
      translationName,
      transition,
    },
  };
}

/** Cuts the passage into the slides it is inserted with, after a review. */
export async function passageItemWithParts(
  ref: string,
  defaults: PassageDefaults,
  {api, serviceId, sermonTitle}: PassageInsertion,
): Promise<
  Result<
    ServiceItemOf<'bible'> | null,
    {readonly reason: 'full'; readonly message: string}
  >
> {
  const {serviceEpoch} = useShow.getState();
  const isCurrent = (): boolean => {
    const view = useShow.getState();
    return view.serviceId === serviceId && view.serviceEpoch === serviceEpoch;
  };
  if (!isCurrent()) return {ok: true, value: null};
  const item = passageItem(ref, defaults);
  if (defaults.passage === undefined) return {ok: true, value: item};
  const split = passageSplitter()?.split(defaults.passage, {
    verseNumbers: item.bible.verseNumbers,
  });
  if (split == null) throw Error('절 나누기를 측정할 수 없음');
  if (
    split.parts.length + (sermonTitle === undefined ? 0 : 2) >
    SHOW_SERVICE_LIMITS.tiles
  ) {
    return {
      ok: false,
      error: {reason: 'full', message: '슬라이드가 너무 많습니다'},
    };
  }
  const {transition} = item.bible;
  let slides = slidesOfParts(split.parts, {transition});
  const references = versesToReview(split.parts);
  if (
    references.length > 0 &&
    (await api.preferences.get()).bible.splitEditorAutoOpen
  ) {
    const reviewed = await reviewBibleInsertion({
      serviceId,
      serviceEpoch,
      projection: split,
      references,
    });
    if (reviewed === null) return {ok: true, value: null};
    for (const reference of references) {
      const texts = reviewed[verseKey(reference)];
      if (texts !== undefined) {
        slides = cutVerse(slides, reference, {texts, transition});
      }
    }
  }
  return isCurrent()
    ? {ok: true, value: {...item, bible: {...item.bible, slides}}}
    : {ok: true, value: null};
}
