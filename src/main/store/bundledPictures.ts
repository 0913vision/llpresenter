import scripture from './assets/scripture-82.png?asset';
import sermonTitle from './assets/sermon-title-81.png?asset';
import sermonTwoLines from './assets/sermon-title-two-lines.png?asset';
import {SUNDAY_PICTURE_IDS} from '@core/themes/sundayScripture';
import type {InitialPicture} from './initialPictures';

export const SUNDAY_PICTURES: readonly InitialPicture[] = [
  {id: SUNDAY_PICTURE_IDS.scripture, name: '말씀 배경', file: scripture},
  {id: SUNDAY_PICTURE_IDS.sermon, name: '설교 제목 배경', file: sermonTitle},
  {
    id: SUNDAY_PICTURE_IDS.sermonTwoLines,
    name: '설교 제목 두 줄 배경',
    file: sermonTwoLines,
  },
];
