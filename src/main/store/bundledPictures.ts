import scripture from './assets/scripture-82.png?asset';
import notice from './assets/notice-122.png?asset';
import noticeDivider from './assets/notice-divider.png?asset';
import serviceTimes from './assets/service-times-142.png?asset';
import serviceTimesBright from './assets/service-times-bright-142.png?asset';
import preparation from './assets/wait-1.png?asset';
import sectionRules from './assets/section-rules.png?asset';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/themes/pictures';
import type {BundledPicture} from './bundledPicture';
import {
  SUNDAY_NOTICE_PICTURE_ID,
  SUNDAY_NOTICE_DIVIDER_ID,
} from '@core/themes/sundayNotice';
import {SUNDAY_PICTURE_IDS} from '@core/themes/sundayScripture';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';
import {SECTION_RULES_ID} from '@core/themes/sundaySections';

const files = new Map([
  [SUNDAY_NOTICE_PICTURE_ID, notice],
  [SUNDAY_PICTURE_IDS.scripture, scripture],
  [SUNDAY_STANDBY_PICTURE_IDS.serviceTimes, serviceTimes],
  [SUNDAY_STANDBY_PICTURE_IDS.serviceTimesBright, serviceTimesBright],
  [SUNDAY_STANDBY_PICTURE_IDS.preparation, preparation],
  [SUNDAY_NOTICE_DIVIDER_ID, noticeDivider],
  [SECTION_RULES_ID, sectionRules],
]);

export const SUNDAY_PICTURES: readonly BundledPicture[] = [
  ...THEME_BACKGROUNDS,
  ...THEME_DECORATIONS,
].map(picture => {
  const file = files.get(picture.id);
  if (file === undefined) throw Error('Missing bundled theme picture');
  return {...picture, file};
});
