import type {Result} from '@core/common/result';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';

interface Refusal {
  readonly reason: string;
  readonly message: string;
}

/** The title of a refused 예배 순서 change: a full list says so, anything else the fallback. */
export function orderFailureTitle(error: Refusal, fallback: string): string {
  return error.reason === 'full' ? error.message : fallback;
}

/** The notice of a refused change of the open service; null when it went through. */
export function serviceEditNotice(
  result: Result<unknown, Refusal>,
): Notice | null {
  if (result.ok) return null;
  return {
    key: `slides:${result.error.reason}`,
    kind: 'warning',
    icon: 'warning',
    title:
      result.error.reason === 'write-failed'
        ? '예배 저장 실패'
        : orderFailureTitle(result.error, '슬라이드 변경 실패'),
    time: noticeTime(),
  };
}
