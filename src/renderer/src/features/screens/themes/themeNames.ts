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
  missing: '테마 또는 화면을 찾을 수 없음',
  name: '이름은 1~80자로 입력',
  taken: '같은 이름의 테마가 있음',
  full: '테마 또는 화면 수 제한에 도달함',
  'duplicate-id': '테마 추가 실패',
  standby: '대기 화면에서는 사용할 수 없음',
  'confirmation-required': '테마 삭제 확인 필요',
  elements: '이 화면에 추가할 수 없는 요소',
  link: '연결할 수 없는 화면',
  invalid: '변경할 수 없는 값',
};
export const THEME_READ_ONLY = NEWER_FILE_REASON;
