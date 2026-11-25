import {dialog} from 'electron';

/** Reports a control-page load failure before the initial splash is dismissed. */
export function showStartupError(): void {
  dialog.showErrorBox(
    '시작 오류',
    '화면을 불러올 수 없습니다. 프로그램을 다시 실행하세요.',
  );
}
