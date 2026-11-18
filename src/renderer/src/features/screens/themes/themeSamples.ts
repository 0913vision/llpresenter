import type {ThemeId} from '@core/schema/ids';
import {isSectionTheme} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {themeElementNames} from './themeNames';

export const themeSamples = {
  ...themeElementNames,
  media: '미디어 미리보기',
  background: '배경 미리보기',
  overlay: '오버레이 미리보기',
  currentText: '함께 노래합니다\n오늘도 빛을 비춥니다',
  nextText: '다음 이야기를 기다립니다',
  clock: '09:41',
  timer: '05:00',
  videoTimeLeft: '02:30',
  reference: '요한복음 3:16',
  itemName: '함께 노래합니다',
  slideName: '첫 번째 슬라이드',
  stageMessage: '다음 순서를 준비해 주세요',
  memo: '후렴을 한 번 더 부릅니다',
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
  itemName: '묵상기도',
  reference: '요한복음 3:16',
  currentText: 'MEDITATION',
  nextText: '다음 이야기를 기다립니다',
  label: '1절',
  nextLabel: '후렴',
};

export const sermonTitleSamples = {
  ...themeSamples,
  itemName: '요한복음 3:16',
  reference: '요한복음 3:16',
  currentText: '설교 제목',
  nextText: '다음 이야기를 기다립니다',
  label: '1절',
  nextLabel: '후렴',
};

export function themeSamplesFor(id: ThemeId | undefined, sectionBand = false) {
  if (isSectionTheme(id)) return sectionSamples;
  if (id === SERMON_TITLE_THEME_ID) return sermonTitleSamples;
  return sectionBand ? sectionBandSamples : themeSamples;
}
