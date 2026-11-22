import {createMediaId, type MediaId} from '../schema/ids';

/** A picture that comes with the app. */
export interface ThemePicture {
  readonly id: MediaId;
  readonly name: string;
}

const id = (number: number) =>
  createMediaId(`00000000-0000-4000-8000-${String(number).padStart(12, '0')}`);

export const APP_PICTURE_IDS = {
  scripture: id(381),
  notice: id(384),
  noticeDivider: id(385),
  serviceTimes: id(390),
  preparation: id(391),
  serviceTimesBright: id(392),
  titleRules: id(407),
} as const;

/** The pictures of the app that are offered as backgrounds. */
export const THEME_BACKGROUNDS: readonly ThemePicture[] = [
  {id: APP_PICTURE_IDS.notice, name: '광고 배경'},
  {id: APP_PICTURE_IDS.scripture, name: '말씀 배경'},
  {id: APP_PICTURE_IDS.serviceTimesBright, name: '예배 안내 배경 (밝게)'},
  {id: APP_PICTURE_IDS.serviceTimes, name: '예배 안내 배경 (어둡게)'},
  {id: APP_PICTURE_IDS.preparation, name: '예배 준비 배경'},
];

/** Decorations keep their names when selected in an existing theme. */
export const THEME_DECORATIONS: readonly ThemePicture[] = [
  {id: APP_PICTURE_IDS.noticeDivider, name: '광고 사선'},
  {id: APP_PICTURE_IDS.titleRules, name: '타이틀 선'},
];
