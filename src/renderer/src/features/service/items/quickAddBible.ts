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

/** The 환경설정 values a new passage starts with; absent ones are the built-in ones. */
export interface PassageDefaults {
  readonly translation: BibleLookupReply['translation'];
  readonly verseNumbers: boolean;
  /** Accepted from old preferences; new passages always start each verse anew. */
  readonly split?: BiblePassage['split'];
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

/** Records the transition for every measured part before inserting a passage. */
export async function passageItemWithParts(
  ref: string,
  defaults: PassageDefaults,
  api: Pick<LlpApi, 'settings'>,
): Promise<ServiceItem> {
  const item = passageItem(ref, defaults);
  if (!isItemOfKind(item, 'bible') || defaults.passage === undefined) {
    return item;
  }
  const canvas = createBibleMeasureContext();
  if (canvas === null) return item;
  const [themes, screens, saved] = await Promise.all([
    api.settings.get({name: 'themes'}),
    api.settings.get({name: 'screens'}),
    api.settings.get({name: 'bibleCuts'}),
  ]);
  if (
    themes.name !== 'themes' ||
    screens.name !== 'screens' ||
    saved.name !== 'bibleCuts'
  ) {
    return item;
  }
  const projected = new BibleProjections({
    themes: themes.value,
    screens: screens.value.screens,
    saved: saved.value,
    canvas,
  }).get({
    id: item.id,
    kind: 'bible',
    source: 'service',
    passage: defaults.passage,
    verseNumbers: item.bible.verseNumbers,
    reference: item.bible.reference,
    translationName: item.bible.translationName,
    review: false,
  });
  if (projected === null || projected.problem !== undefined) return item;
  const transition = defaults.transition ?? defaultSlideTransitions.bible;
  return {
    ...item,
    bibleTransitions: projected.parts.map(part => ({
      verse: part.reference,
      part: part.part,
      transition,
    })),
  };
}
