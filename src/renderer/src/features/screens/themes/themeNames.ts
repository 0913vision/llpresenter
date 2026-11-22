import {
  type AddableKind,
  type ThemeListProblem,
  templateTokens,
} from '@core/theme';
import type {
  SlidePurpose,
  ThemeElement,
  ThemeElementKind,
} from '@core/schema/theme';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';

/** What the slides a theme is for are called. */
export const purposeNames: Readonly<Record<SlidePurpose, string>> = {
  songTitle: '찬양 제목',
  lyrics: '찬양 가사',
  sermonTitle: '설교 제목',
  scripture: '말씀 본문',
  notice: '광고',
  title: '타이틀',
  creed: '사도신경, 주기도문',
  preparation: '예배 준비',
  standby: '대기 화면',
  blank: '빈 슬라이드',
  picture: '이미지',
  media: '영상',
};

const kindNames: Readonly<Record<ThemeElementKind, string>> = {
  text: '글',
  next: '미리 보여줄 내용',
  picture: '이미지',
  background: '배경',
  shape: '사각형',
};

export const addableNames: Readonly<Record<AddableKind, string>> = {
  box: '글 상자',
  text: '글',
  next: '미리 보여줄 내용',
  picture: '이미지',
  shape: '사각형',
  background: '배경',
};

/** What an element is called: the values a text shows, or its own words. */
export function elementName(element: ThemeElement): string {
  if (element.kind !== 'text') return kindNames[element.kind];
  const tokens = [...templateTokens(element.content.slice(0, 1))];
  if (tokens.length > 0) return tokens.join(', ');
  const words = element.content[0]?.split('\n')[0]?.trim() ?? '';
  return words === '' ? kindNames.text : words;
}

export const themeProblems: Readonly<Record<ThemeListProblem, string>> = {
  missing: '테마를 찾을 수 없습니다',
  name: '이름을 확인해 주세요',
  taken: '같은 이름의 테마가 있음',
  full: '테마는 더 만들 수 없습니다',
  own: '기본 테마는 삭제할 수 없습니다',
};
export const INVALID_CHANGE = '변경할 수 없는 값';
export const THEME_READ_ONLY = NEWER_FILE_REASON;
