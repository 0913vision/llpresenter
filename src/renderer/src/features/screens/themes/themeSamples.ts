import type {ThemeId} from '@core/schema/ids';
import {isSectionTheme} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {themeElementNames} from './themeNames';

export const themeSamples = {
  ...themeElementNames,
  currentText: '함께 노래합니다\n오늘도 빛을 비춥니다',
  nextText: '다음 이야기를 기다립니다',
  clock: '09:41',
  timer: '05:00',
  videoTimeLeft: '02:30',
  reference: '요한복음 1:1',
  slideNumber: '1',
  label: '1절',
  nextLabel: '후렴',
};
export const sectionBandSamples = {
  ...themeSamples,
  itemName: '사도신경',
};
export const sectionSamples = {
  ...themeSamples,
  itemName: '구역 이름',
  reference: '성경 출처',
  currentText: '영문 이름',
  nextText: '다음 슬라이드 글',
  label: '이름표',
  nextLabel: '다음 이름표',
};

export const sermonTitleSamples = {
  ...themeSamples,
  itemName: '성경 구절',
  reference: '성경 구절',
  currentText: '설교 제목',
  nextText: '다음 슬라이드 글',
  label: '이름표',
  nextLabel: '다음 이름표',
};

export function themeSamplesFor(id: ThemeId | undefined, sectionBand = false) {
  if (isSectionTheme(id)) return sectionSamples;
  if (id === SERMON_TITLE_THEME_ID) return sermonTitleSamples;
  return sectionBand ? sectionBandSamples : themeSamples;
}
