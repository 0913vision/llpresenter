import {createServiceItemId} from '@core/schema/ids';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import type {ServiceItem} from '@core/schema/service';

export interface PassageDefaults {
  readonly translation: BibleLookupReply['translation'];
  readonly verseNumbers: boolean;
}

/** A passage item with the default settings of a new Bible item (spec 05). */
export function passageItem(
  ref: string,
  {translation, verseNumbers}: PassageDefaults,
): ServiceItem {
  return {
    id: createServiceItemId(crypto.randomUUID()),
    bible: {
      translation,
      ref,
      split: 'verse',
      reference: 'every',
      verseNumbers,
      translationName: false,
    },
  };
}
