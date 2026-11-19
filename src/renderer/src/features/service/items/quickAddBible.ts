import {createServiceItemId} from '@core/schema/ids';
import type {Result} from '@core/common/result';
import type {EditFailure} from '@core/schema/contentEdit';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import type {ServiceItem} from '@core/schema/service';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {SlideTransition} from '@core/schema/slideTransition';
import {passageBook} from '@core/bible/adjacentVerses';
import {defaultSlideTransitions} from '@core/schema/preferences';
import type {LlpApi} from '@contracts/ipc/api';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {BibleProjections} from '@renderer/features/bible/splitProjection';
import {useShow} from '@renderer/session/showStore';
import {isItemOfKind} from '@core/schema/service';
import {versesToReview} from '@core/bible/split/splitVerses';
import {cacheKey, knownCutEntryFor} from '@core/bible/split/splitCache';
import {reviewBibleInsertion} from '@renderer/features/bible/reviewBibleInsertion';

interface PassageInsertion {
  readonly api: Pick<LlpApi, 'settings' | 'preferences'>;
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
    passage,
  }: PassageDefaults,
): ServiceItem {
  const book = passage === undefined ? undefined : passageBook(passage);
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
    ...(passage === undefined || book === undefined
      ? {}
      : {
          bibleTransitions: passage.verses.map(verse => ({
            verse: {
              translation: passage.translation,
              book: book.id,
              chapter: verse.chapter,
              verse: verse.verse,
            },
            part: 1,
            transition,
          })),
        }),
  };
}

/** Stages long verses before recording the transitions and inserting the passage. */
export async function passageItemWithParts(
  ref: string,
  defaults: PassageDefaults,
  {api, serviceId, sermonTitle}: PassageInsertion,
): Promise<Result<ServiceItem | null, EditFailure>> {
  const {serviceEpoch} = useShow.getState();
  const isCurrent = () => {
    const view = useShow.getState();
    return view.serviceId === serviceId && view.serviceEpoch === serviceEpoch;
  };
  if (!isCurrent()) return {ok: true, value: null};
  const item = passageItem(ref, defaults);
  if (!isItemOfKind(item, 'bible') || defaults.passage === undefined) {
    return {ok: true, value: item};
  }
  const canvas = createBibleMeasureContext();
  if (canvas === null) throw Error('절 나누기를 측정할 수 없음');
  const [themes, screens, saved] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
    api.settings.get({name: 'bibleCuts'}),
  ]);
  if (!isCurrent()) return {ok: true, value: null};
  if (
    themes.name !== 'themes' ||
    screens.name !== 'screens' ||
    saved.name !== 'bibleCuts'
  ) {
    throw Error('절 나누기 불러오기 실패');
  }
  const source = {
    id: item.id,
    kind: 'bible',
    source: 'service',
    passage: defaults.passage,
    verseNumbers: item.bible.verseNumbers,
    reference: item.bible.reference,
    translationName: item.bible.translationName,
    ...(sermonTitle === undefined ? {} : {sermonTitle}),
    review: false,
  } as const;
  const book = passageBook(source.passage);
  if (book === undefined) throw Error('성경 구절 불러오기 실패');
  const initialCuts = Object.fromEntries(
    source.passage.verses.flatMap(verse => {
      const reference = {
        translation: source.passage.translation,
        book: book.id,
        chapter: verse.chapter,
        verse: verse.verse,
      };
      const entry = knownCutEntryFor(saved.value, reference, verse.text);
      return entry === undefined ? [] : [[cacheKey(reference), entry] as const];
    }),
  );
  const projections = new BibleProjections({
    themes: themes.value,
    screens: screens.value.screens,
    saved: undefined,
    canvas,
  });
  const measure = (cuts: typeof initialCuts) => {
    const projection = projections.get({...source, cuts});
    if (projection?.problem === 'tile-limit') {
      return {
        ok: false,
        error: {reason: 'full', message: '슬라이드가 너무 많습니다'},
      } as const;
    }
    if (
      projection === null ||
      projection.parts.some(part => part.problem !== undefined)
    ) {
      throw Error('절 나누기를 측정할 수 없음');
    }
    return {ok: true, value: projection} as const;
  };
  let measured = measure(initialCuts);
  if (!measured.ok) return measured;
  const references = versesToReview(measured.value.parts);
  const autoOpen =
    references.length > 0 &&
    (await api.preferences.get()).bible.splitEditorAutoOpen;
  if (!isCurrent()) return {ok: true, value: null};
  if (autoOpen) {
    const projected = measured.value;
    const confirmed = await reviewBibleInsertion({
      serviceId,
      serviceEpoch,
      projection: {...projected, source: {...projected.source, review: true}},
      references,
    });
    if (confirmed === null || !isCurrent()) return {ok: true, value: null};
    measured = measure({...initialCuts, ...confirmed});
    if (!measured.ok) return measured;
  }
  const projected = measured.value;
  const transition = defaults.transition ?? defaultSlideTransitions.bible;
  return {
    ok: true,
    value: {
      ...item,
      bible: {...item.bible, cuts: projected.source.cuts ?? {}},
      bibleTransitions: projected.parts.map(part => ({
        verse: part.reference,
        part: part.part,
        transition,
      })),
    },
  };
}
