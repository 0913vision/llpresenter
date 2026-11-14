import type {Translation} from '../schema/bible';
import {LIVE_BIBLE_ID} from '../schema/ids';
export {LIVE_BIBLE_ID} from '../schema/ids';

export const LIVE_BIBLE: Translation = {
  id: LIVE_BIBLE_ID,
  name: '개역개정 (실시간)',
  lang: 'ko',
  file: 'bsk-gae.llbible',
  default: false,
};

export function withLiveBible(
  translations: readonly Translation[],
): readonly Translation[] {
  return translations.some(item => item.id === LIVE_BIBLE_ID)
    ? translations
    : [...translations, LIVE_BIBLE];
}
