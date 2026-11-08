import {createServiceItemId} from '@core/schema/ids';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import type {ServiceItem} from '@core/schema/service';
import type {BiblePassage} from '@core/schema/biblePassage';

/** The 환경설정 values a new passage starts with; absent ones are the built-in ones. */
export interface PassageDefaults {
  readonly translation: BibleLookupReply['translation'];
  readonly verseNumbers: boolean;
  /** Accepted from old preferences; new passages always start each verse anew. */
  readonly split?: BiblePassage['split'];
  readonly reference?: BiblePassage['reference'];
  readonly translationName?: boolean;
}

/** A passage item with the default settings of a new Bible item (spec 05). */
export function passageItem(
  ref: string,
  {
    translation,
    verseNumbers,
    reference = 'every',
    translationName = false,
  }: PassageDefaults,
): ServiceItem {
  return {
    id: createServiceItemId(crypto.randomUUID()),
    bible: {
      translation,
      ref,
      split: 'verse',
      reference,
      verseNumbers,
      translationName,
    },
  };
}
