import scripture from './assets/scripture-82.png?asset';
import sermonTitle from './assets/sermon-title-81.png?asset';
import sermonTwoLines from './assets/sermon-title-two-lines.png?asset';
import notice from './assets/notice-122.png?asset';
import noticeDivider from './assets/notice-divider.png?asset';
import serviceTimes from './assets/service-times-142.png?asset';
import preparation from './assets/wait-1.png?asset';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';
import {
  SUNDAY_NOTICE_PICTURE_ID,
  SUNDAY_NOTICE_DIVIDER_ID,
} from '@core/themes/sundayNotice';
import {SUNDAY_PICTURE_IDS} from '@core/themes/sundayScripture';
import type {InitialPicture} from './initialPictures';

export const SUNDAY_PICTURES: readonly InitialPicture[] = [
  {
    id: SUNDAY_STANDBY_PICTURE_IDS.serviceTimes,
    name: '예배 안내 배경',
    file: serviceTimes,
  },
  {
    id: SUNDAY_STANDBY_PICTURE_IDS.preparation,
    name: '예배 준비 배경',
    file: preparation,
  },
  {id: SUNDAY_NOTICE_PICTURE_ID, name: '광고 배경', file: notice},
  {id: SUNDAY_NOTICE_DIVIDER_ID, name: '광고 사선', file: noticeDivider},
  {id: SUNDAY_PICTURE_IDS.scripture, name: '말씀 배경', file: scripture},
  {id: SUNDAY_PICTURE_IDS.sermon, name: '설교 제목 배경', file: sermonTitle},
  {
    id: SUNDAY_PICTURE_IDS.sermonTwoLines,
    name: '설교 제목 두 줄 배경',
    file: sermonTwoLines,
  },
];
