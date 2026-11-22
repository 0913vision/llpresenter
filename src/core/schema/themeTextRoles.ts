/** What a text box of a theme can show. */
export const themeTextRoles = [
  'currentText',
  'reference',
  'nextText',
  'label',
  'nextLabel',
  'itemName',
  'slideName',
  'slideNumber',
  'text',
  'clock',
  'timer',
  'videoTimeLeft',
  'stageMessage',
  'memo',
] as const;

export type ThemeTextRole = (typeof themeTextRoles)[number];

export const themeTextRoleNames: Readonly<Record<ThemeTextRole, string>> = {
  currentText: '현재 슬라이드 글',
  reference: '성경 출처',
  nextText: '다음 슬라이드 글',
  label: '이름표',
  nextLabel: '다음 이름표',
  itemName: '항목 이름',
  slideName: '슬라이드 이름',
  slideNumber: '슬라이드 번호',
  text: '글자',
  clock: '시계',
  timer: '타이머',
  videoTimeLeft: '영상 남은 시간',
  stageMessage: '무대 메시지',
  memo: '메모',
};
