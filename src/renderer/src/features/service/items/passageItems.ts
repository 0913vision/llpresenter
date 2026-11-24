import {showsTranslationName} from '@core/bible';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {Translation} from '@core/schema/bible/bible';
import type {BiblePassage} from '@core/schema/bible/biblePassage';
import type {TranslationId} from '@core/schema/common/ids';
import type {ServiceItemOf} from '@core/schema/services/service';
import {bibleItem, sermonItem} from '@core/slides';
import {makePassageSlides} from '@renderer/features/bible/makePassageSlides';
import {slideMaking} from '@renderer/platform/documents/themes';

/**
 * How a new passage starts: its 절 번호 from 환경설정, and the 기본 역본, whose
 * name it hides while every other translation shows its name.
 */
export interface PassageDefaults extends Pick<BiblePassage, 'verseNumbers'> {
  readonly translation: TranslationId;
  /** The translations of 환경설정 \> 성경, which tell the 기본 역본. */
  readonly translations: readonly Translation[];
}

/** The settings a new passage starts with, from the defaults. */
export function passageSettingsOf(
  passage: BibleLookupPassage,
  {verseNumbers, translations}: PassageDefaults,
): BiblePassage {
  return {
    translation: passage.translation,
    ref: passage.ref,
    verseNumbers,
    translationName: showsTranslationName(passage.translation, translations),
  };
}

/** A passage as an item; null when its slides were not settled. */
export async function newBibleItem(
  passage: BibleLookupPassage,
  defaults: PassageDefaults,
): Promise<ServiceItemOf<'bible'> | null> {
  const api = window.llp;
  if (api === undefined) return null;
  const settings = passageSettingsOf(passage, defaults);
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
  const settings = passageSettingsOf(passage, defaults);
  const slides = await makePassageSlides(api, passage, {settings});
  return slides === null
    ? null
    : sermonItem(slideMaking(), {title, passage: settings, slides});
}
