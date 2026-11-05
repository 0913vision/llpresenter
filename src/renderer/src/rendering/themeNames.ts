import type {ThemeElementKind} from '@core/themes/elementRules';

export const themeElementNames: Readonly<Record<ThemeElementKind, string>> = {
  currentText: '현재 가사',
  reference: '성경 출처',
  nextText: '다음 가사',
  label: '이름표',
  nextLabel: '다음 이름표',
  media: '미디어',
  background: '배경',
  overlay: '오버레이',
  itemName: '항목 이름',
  slideName: '슬라이드 이름',
  text: '글자',
  image: '이미지',
  box: '사각형',
  clock: '시계',
  timer: '타이머',
  videoTimeLeft: '영상 남은 시간',
  stageMessage: '무대 메시지',
  memo: '메모',
};
