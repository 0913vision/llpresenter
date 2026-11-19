import type {MediaId} from '../schema/ids';
import {
  SUNDAY_NOTICE_DIVIDER_ID,
  SUNDAY_NOTICE_PICTURE_ID,
} from './sundayNotice';
import {SUNDAY_PICTURE_IDS} from './sundayScripture';
import {SECTION_RULES_ID} from './sundaySections';
import {SUNDAY_STANDBY_PICTURE_IDS} from './sundayStandby';

export interface ThemePicture {
  readonly id: MediaId;
  readonly name: string;
}

/** App-owned backgrounds offered only by the theme image picker. */
export const THEME_BACKGROUNDS: readonly ThemePicture[] = [
  {id: SUNDAY_NOTICE_PICTURE_ID, name: '광고 배경'},
  {id: SUNDAY_PICTURE_IDS.scripture, name: '말씀 배경'},
  {
    id: SUNDAY_STANDBY_PICTURE_IDS.serviceTimesBright,
    name: '예배 안내 배경 (밝게)',
  },
  {
    id: SUNDAY_STANDBY_PICTURE_IDS.serviceTimes,
    name: '예배 안내 배경 (어둡게)',
  },
  {id: SUNDAY_STANDBY_PICTURE_IDS.preparation, name: '예배 준비 배경'},
];

/** Decorations keep their names when selected in an existing theme. */
export const THEME_DECORATIONS: readonly ThemePicture[] = [
  {id: SUNDAY_NOTICE_DIVIDER_ID, name: '광고 사선'},
  {id: SECTION_RULES_ID, name: '구역 이름 선'},
];
