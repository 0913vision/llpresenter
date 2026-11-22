import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {ServiceItemOf} from '@core/schema/service';
import {bibleItem, sermonItem} from '@core/slides';
import {makePassageSlides} from '@renderer/features/bible/makePassageSlides';
import {slideMaking} from '@renderer/platform/themes';

/** How the slides of a new passage are made, from 환경설정. */
export type PassageDefaults = Pick<
  BiblePassage,
  'verseNumbers' | 'translationName'
>;

function settingsOf(
  passage: BibleLookupPassage,
  {verseNumbers, translationName}: PassageDefaults,
): BiblePassage {
  return {
    translation: passage.translation,
    ref: passage.ref,
    verseNumbers,
    translationName,
  };
}

/** A passage as an item; null when its slides were not settled. */
export async function newBibleItem(
  passage: BibleLookupPassage,
  defaults: PassageDefaults,
): Promise<ServiceItemOf<'bible'> | null> {
  const api = window.llp;
  if (api === undefined) return null;
  const settings = settingsOf(passage, defaults);
  const slides = await makePassageSlides(api, passage, {settings});
  return slides === null ? null : bibleItem(settings, slides);
}

/** A sermon as an item: its title, its passage, and the title again. */
export async function newSermonItem(
  title: string,
  passage: BibleLookupPassage,
  defaults: PassageDefaults,
): Promise<ServiceItemOf<'sermon'> | null> {
  const api = window.llp;
  if (api === undefined) return null;
  const settings = settingsOf(passage, defaults);
  const slides = await makePassageSlides(api, passage, {settings});
  return slides === null
    ? null
    : sermonItem(slideMaking(), {title, passage: settings, slides});
}
