import type {Notice} from '@renderer/ui/popups/notices';
/** Why a file from a newer version cannot be changed, said the same everywhere. */
export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다.';
/** Why a still picture shows where a background video should play. */
export const MISSING_STILL_BACKGROUND_TIP =
  '배경 영상 파일을 찾을 수 없어 정지 화면으로 표시 중';
/** Why a control is off when the window has no app connection to act with. */
export const NOT_IN_THIS_WINDOW = '이 창에서는 쓸 수 없음';
/** Why 실행 취소 is off: the place that has focus has no edit to take back. */
export const NOTHING_TO_UNDO = '되돌릴 편집이 없습니다.';
/** Why 다시 실행 is off. */
export const NOTHING_TO_REDO = '다시 실행할 편집이 없습니다.';

/** Why a 그래픽 cannot be shown: its media left the library. */
/** The title of a passage that could not be read. */
export const PASSAGE_LOAD_FAILED = '구절 불러오기 실패';
/** Why a passage can't be read where the window has no connection to the app. */
export const PASSAGE_UNAVAILABLE = '구절을 불러올 수 없습니다.';
/** A song item whose song file is gone. */
export const MISSING_SONG_TIP = '곡 파일을 찾을 수 없습니다.';
export const MISSING_MEDIA_TIP = '미디어 파일을 찾을 수 없습니다.';

/** 진행 sends what is on the screens; edits are run back in 준비. */
export const NO_UNDO_IN_SHOW = '진행에서는 실행 취소를 쓰지 않습니다.';

/** What is on the screens is not deleted under them. */
export const ON_SCREEN_REASON = '화면에 나가는 중입니다.';

/**
 * Why a change was refused or not saved, and what to do, as the lines under a
 * failure notice's title, the same wherever the reason comes from (user
 * decision, November 26: standard wording, not spoken).
 */
const FAILURE_REASON_LINES: Readonly<Record<string, readonly string[]>> = {
  'write-failed': [
    '변경 내용을 파일에 저장할 수 없습니다.',
    '디스크 공간과 폴더 권한을 확인하십시오.',
  ],
  stale: ['다른 곳에서 먼저 변경되었습니다.', '다시 시도하십시오.'],
  'not-found': ['대상을 찾을 수 없습니다.'],
  'read-only': [NEWER_FILE_REASON],
  'duplicate-title': ['같은 이름이 이미 있습니다.'],
  invalid: ['올바르지 않은 값입니다.'],
  'saves-full': [
    '저장을 기다리는 변경이 너무 많습니다.',
    '잠시 후 다시 시도하십시오.',
  ],
  busy: ['이전 작업이 진행 중입니다.', '잠시 후 다시 시도하십시오.'],
};

/** The lines that say why a refused or unsaved change failed; none for an unknown reason. */
export function failureReasonLines(reason: string): readonly string[] {
  return FAILURE_REASON_LINES[reason] ?? [];
}

/** A failure notice with the lines that say why added under what it says. */
export function withFailureReason(notice: Notice, reason: string): Notice {
  const why = failureReasonLines(reason);
  return why.length === 0
    ? notice
    : {...notice, meta: [...(notice.meta ?? []), ...why]};
}
