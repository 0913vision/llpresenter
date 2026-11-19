import {dialog} from 'electron';

/** Reports a control-page load failure before the initial splash is dismissed. */
export function showStartupError(): void {
  dialog.showErrorBox(
    '시작 오류',
    '화면을 불러오지 못했습니다. 프로그램을 다시 실행해 주세요.',
  );
}
