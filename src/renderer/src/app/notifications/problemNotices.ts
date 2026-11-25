import {launchTaskName} from '@core/app';
import type {AppProblemOf} from '@core/schema/app/appProblem';
import {warningNotice, type Notice} from '@renderer/ui/popups/notices';

/** One card stands for every data file skipped so far. */
export const SKIPPED_FILES_KEY = 'file-skipped';

/** One card stands for every file that waits to be saved. */
export const WAITING_SAVES_KEY = 'save-failed';

/** One card stands for the launch backup that failed. */
export const BACKUP_FAILED_KEY = 'backup-failed';

/** One card stands for the control window that loaded again. */
export const CONTROL_RELOADED_KEY = 'control-reloaded';

/** One card stands for the launch that did not end well. */
export const LAUNCH_FAILED_KEY = 'launch-failed';

const UNNAMED_MACRO = '이름 없는 매크로';

/**
 * The 파일 읽기 실패 card for the skipped files, in the order they came:
 * the first name, and how many more there are (spec 08, "File can't be
 * read"). Gives nothing when no file was skipped.
 */
export function skippedFilesCard(
  names: readonly string[],
  time: string,
): Notice | null {
  const [first] = names;
  if (first === undefined) return null;
  return {
    key: SKIPPED_FILES_KEY,
    kind: 'warning',
    icon: 'filex',
    title: '파일 읽기 실패',
    time,
    meta: [nameWithMore(first, names.length), '건너뜀'],
  };
}

function nameWithMore(name: string, count: number): string {
  return count <= 1 ? name : `${name} 외 ${count - 1}개`;
}

/**
 * The 저장할 수 없음 card for the files that wait in memory: the oldest one's
 * name and how many more, with 다시 시도 (spec 02, "Save failures").
 */
export function waitingSavesCard(
  {name, count}: AppProblemOf<'save-failed'>,
  {time, retry}: {readonly time: string; readonly retry: () => void},
): Notice {
  return {
    key: WAITING_SAVES_KEY,
    kind: 'warning',
    icon: 'warning',
    title: '저장 실패',
    time,
    meta: [nameWithMore(name, count)],
    actions: [{icon: 'refresh', label: '다시 시도', onSelect: retry}],
  };
}

/**
 * The 매크로 적용 실패 card for a dispatch that was dropped whole (spec 08);
 * the same 매크로 again replaces its card.
 */
export function macroDroppedCard(
  {macroId, name}: AppProblemOf<'macro-dropped'>,
  time: string,
): Notice {
  return {
    key: `macro-dropped:${macroId}`,
    kind: 'warning',
    icon: 'macro',
    title: '매크로 적용 실패',
    time,
    meta: [name === '' ? UNNAMED_MACRO : name],
  };
}

/**
 * The 백업 위치를 쓸 수 없습니다 card for a launch backup that failed (spec 08);
 * the detail names the folder and says nothing was backed up.
 */
export function backupFailedCard(
  {name}: AppProblemOf<'backup-failed'>,
  time: string,
): Notice {
  return {
    key: BACKUP_FAILED_KEY,
    kind: 'warning',
    icon: 'warning',
    title: '백업 위치를 쓸 수 없습니다.',
    time,
    meta: [name, '백업 안 함'],
  };
}

/**
 * The 제어 창 다시 불러옴 information card after the control window's renderer
 * died and loaded again (spec 08); it closes by itself.
 */
export function controlReloadedCard(time: string): Notice {
  return {
    key: CONTROL_RELOADED_KEY,
    kind: 'info',
    icon: 'refresh',
    title: '제어 창 다시 불러옴',
    time,
    meta: ['출력은 그대로'],
  };
}

/**
 * The 시작 준비 실패 card for a launch in which tasks failed or did not end in
 * time, with what they prepare.
 */
export function launchFailedCard(
  {tasks}: AppProblemOf<'launch-failed'>,
  {time, openLogs}: {readonly time: string; readonly openLogs: () => void},
): Notice {
  return {
    key: LAUNCH_FAILED_KEY,
    kind: 'warning',
    icon: 'warning',
    title: '시작 준비 실패',
    time,
    meta: [tasks.map(launchTaskName).join(', ')],
    actions: [{icon: 'folder', label: '로그 폴더 열기', onSelect: openLogs}],
  };
}

/**
 * The card of an NDI problem: no NDI Runtime on this PC, a GPU path that fell
 * back to the plain one, or an NDI output that failed and shows its capture
 * window.
 */
export function ndiCard(
  kind: 'ndi-runtime-missing' | 'ndi-gpu-fallback' | 'ndi-failed',
): Notice {
  switch (kind) {
    case 'ndi-runtime-missing':
      return warningNotice(kind, 'NDI Runtime을 찾을 수 없습니다.', [
        '캡처용 창을 사용할 수 있습니다.',
      ]);
    case 'ndi-gpu-fallback':
      return warningNotice(
        kind,
        '하드웨어 가속을 쓸 수 없어 일반 방식으로 보냅니다.',
      );
    case 'ndi-failed':
      return warningNotice(kind, 'NDI 출력 실패', ['캡처용 창으로 표시 중']);
  }
}

/** The card of a 진행 복구 기록 or 이전 판 that could not be saved, under `key`. */
export function protectionWriteCard(
  key: string,
  target: AppProblemOf<'protection-write'>['target'],
): Notice {
  return warningNotice(
    key,
    target === 'record' ? '진행 복구 기록 저장 실패' : '이전 판 저장 실패',
  );
}

/** The card shown after the window's pictures were drawn again. */
export function graphicsRecoveredCard(time: string): Notice {
  return {
    key: 'graphics-recovered',
    kind: 'info',
    icon: 'refresh',
    title: '화면을 다시 그렸습니다.',
    time,
  };
}
