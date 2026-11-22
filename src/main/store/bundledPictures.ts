import scripture from './assets/scripture-82.png?asset';
import notice from './assets/notice-122.png?asset';
import noticeDivider from './assets/notice-divider.png?asset';
import serviceTimes from './assets/service-times-142.png?asset';
import serviceTimesBright from './assets/service-times-bright-142.png?asset';
import preparation from './assets/wait-1.png?asset';
import sectionRules from './assets/section-rules.png?asset';
import {
  APP_PICTURE_IDS,
  THEME_BACKGROUNDS,
  THEME_DECORATIONS,
} from '@core/theme/pictures';
import type {BundledPicture} from './bundledPicture';

const files = new Map([
  [APP_PICTURE_IDS.notice, notice],
  [APP_PICTURE_IDS.scripture, scripture],
  [APP_PICTURE_IDS.serviceTimes, serviceTimes],
  [APP_PICTURE_IDS.serviceTimesBright, serviceTimesBright],
  [APP_PICTURE_IDS.preparation, preparation],
  [APP_PICTURE_IDS.noticeDivider, noticeDivider],
  [APP_PICTURE_IDS.titleRules, sectionRules],
]);

export const SUNDAY_PICTURES: readonly BundledPicture[] = [
  ...THEME_BACKGROUNDS,
  ...THEME_DECORATIONS,
].map(picture => {
  const file = files.get(picture.id);
  if (file === undefined) throw Error('Missing bundled theme picture');
  return {...picture, file};
});
