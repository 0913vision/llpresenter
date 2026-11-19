import {createServiceItemId} from '@core/schema/ids';
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
import {isItemOfKind} from '@core/schema/service';
import {versesToReview} from '@core/bible/split/splitVerses';
import {cacheKey} from '@core/bible/split/splitCache';
import {reviewBibleInsertion} from '@renderer/features/bible/reviewBibleInsertion';
import type {BibleCutsFile} from '@core/schema/bibleCuts';

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
  api: Pick<LlpApi, 'settings' | 'preferences'>,
): Promise<ServiceItem | null> {
  const item = passageItem(ref, defaults);
  if (!isItemOfKind(item, 'bible') || defaults.passage === undefined) {
    return item;
  }
  const canvas = createBibleMeasureContext();
  if (canvas === null) return item;
  const [themes, screens, saved, preferences] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
    api.settings.get({name: 'bibleCuts'}),
    api.preferences.get(),
  ]);
  if (
    themes.name !== 'themes' ||
    screens.name !== 'screens' ||
    saved.name !== 'bibleCuts'
  ) {
    return item;
  }
  const source = {
    id: item.id,
    kind: 'bible',
    source: 'service',
    passage: defaults.passage,
    verseNumbers: item.bible.verseNumbers,
    reference: item.bible.reference,
    translationName: item.bible.translationName,
    review: false,
  } as const;
  const book = passageBook(source.passage);
  if (book === undefined) return item;
  const measure = (file: BibleCutsFile) => {
    const translation = file.entries[source.passage.translation];
    const cuts = Object.fromEntries(
      source.passage.verses.flatMap(verse => {
        const key = cacheKey({
          translation: source.passage.translation,
          book: book.id,
          chapter: verse.chapter,
          verse: verse.verse,
        });
        const entry = translation?.[key];
        return entry === undefined ? [] : [[key, entry] as const];
      }),
    );
    return new BibleProjections({
      themes: themes.value,
      screens: screens.value.screens,
      saved: undefined,
      canvas,
    }).get({...source, cuts});
  };
  let projected = measure(saved.value);
  if (projected === null || projected.problem !== undefined) return item;
  const references = versesToReview(projected.parts);
  if (preferences.bible.splitEditorAutoOpen && references.length > 0) {
    if (
      !(await reviewBibleInsertion(
        {...projected, source: {...projected.source, review: true}},
        references,
      ))
    ) {
      return null;
    }
    const confirmed = await api.settings.get({name: 'bibleCuts'});
    if (confirmed.name !== 'bibleCuts') throw Error('절 나누기 불러오기 실패');
    projected = measure(confirmed.value);
    if (projected === null || projected.problem !== undefined) {
      throw Error('절 나누기를 측정할 수 없음');
    }
  }
  const transition = defaults.transition ?? defaultSlideTransitions.bible;
  return {
    ...item,
    bible: {...item.bible, cuts: projected.source.cuts ?? {}},
    bibleTransitions: projected.parts.map(part => ({
      verse: part.reference,
      part: part.part,
      transition,
    })),
  };
}
