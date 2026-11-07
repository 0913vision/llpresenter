import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {ThemeItemKind} from '@core/themes/elementRules';
import type {ThemeEditProblem} from '@core/themes/themeEdits';

export {themeElementNames} from '@renderer/rendering/themeNames';
export const themeKindNames: Readonly<Record<ThemeItemKind, string>> = {
  song: '곡',
  bible: '성경',
  blank: '빈 슬라이드',
  ad: '광고',
  media: '미디어',
};
export const themeProblems: Readonly<Record<ThemeEditProblem, string>> = {
  missing: '테마나 화면을 찾을 수 없습니다',
  name: '이름이 너무 깁니다',
  taken: '같은 이름의 테마가 있음',
  full: '테마나 화면은 더 만들 수 없습니다',
  'duplicate-id': '테마 추가 실패',
  standby: '대기 화면에서는 쓸 수 없습니다',
  'confirmation-required': '테마 삭제 확인 필요',
  elements: '이 화면에는 추가할 수 없는 요소입니다',
  link: '연결할 수 없는 화면입니다',
  invalid: '변경할 수 없는 값',
};
export const THEME_READ_ONLY = NEWER_FILE_REASON;
