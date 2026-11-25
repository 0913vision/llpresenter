import type {Result} from '@core/common/result';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {failureReasonLines} from '@renderer/platform/problemReasons';

/** The title of the card of a 예배, 템플릿 or row that could not be renamed. */
export const RENAME_FAILED = '이름 바꾸기 실패';

interface Refusal {
  readonly reason: string;
  readonly message: string;
}

/** The title of a refused 예배 순서 change: a full list says so, anything else the fallback. */
export function orderFailureTitle(error: Refusal, fallback: string): string {
  return error.reason === 'full' ? error.message : fallback;
}

/**
 * The notice of a refused or unsaved 예배 change: its title, and the lines
 * that say why.
 */
export function orderFailureNotice(
  key: string,
  error: Refusal,
  fallback: string,
): Notice {
  return warningNotice(
    key,
    error.reason === 'write-failed'
      ? '예배 저장 실패'
      : orderFailureTitle(error, fallback),
    failureReasonLines(error.reason),
  );
}

/** The notice of a refused change of the open service; null when it went through. */
export function serviceEditNotice(
  result: Result<unknown, Refusal>,
): Notice | null {
  if (result.ok) return null;
  return orderFailureNotice(
    `slides:${result.error.reason}`,
    result.error,
    '슬라이드 변경 실패',
  );
}
