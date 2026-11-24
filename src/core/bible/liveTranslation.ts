import type {Translation} from '@core/schema/bible/bible';
import {LIVE_BIBLE_ID} from '@core/schema/common/ids';

/** The built-in 개역개정 translation shown live; it is never the default. */
export const LIVE_BIBLE: Translation = {
  id: LIVE_BIBLE_ID,
  name: '개역개정 (실시간)',
  lang: 'ko',
  file: 'bsk-gae.llbible',
  default: false,
};

/** Adds the live translation to the list unless it is already there. */
export function withLiveBible(
  translations: readonly Translation[],
): readonly Translation[] {
  return translations.some(item => item.id === LIVE_BIBLE_ID)
    ? translations
    : [...translations, LIVE_BIBLE];
}
