import {expect, it} from 'vitest';
import {
  failureReasonLines,
  NEWER_FILE_REASON,
  withFailureReason,
} from '@renderer/platform/problemReasons';
import {warningNotice} from '@renderer/ui/popups/notices';
import {orderFailureNotice} from '@renderer/session/service/serviceProblem';

it('says why a change failed and what to do, in the same words for the same reason', () => {
  expect(failureReasonLines('write-failed')).toEqual([
    '변경 내용을 파일에 저장할 수 없습니다.',
    '디스크 공간과 폴더 권한을 확인해야 합니다.',
  ]);
  expect(failureReasonLines('stale')).toEqual([
    '다른 곳에서 먼저 변경되었습니다.',
    '다시 시도해야 합니다.',
  ]);
  expect(failureReasonLines('read-only')).toEqual([NEWER_FILE_REASON]);
  expect(failureReasonLines('request-failed')).toEqual([]);
});

it('adds the reason under what a notice already says', () => {
  const notice = warningNotice('media-view:history', '미디어 변경 실패', [
    '첫 줄',
  ]);
  expect(withFailureReason(notice, 'not-found').meta).toEqual([
    '첫 줄',
    '대상을 찾을 수 없습니다.',
  ]);
  expect(withFailureReason(notice, 'unknown')).toBe(notice);
});

it('names an unsaved 예배 change and says why', () => {
  const notice = orderFailureNotice(
    'service-order:write-failed',
    {reason: 'write-failed', message: 'disk full'},
    '예배 변경 실패',
  );
  expect(notice.title).toBe('예배 저장 실패');
  expect(notice.meta).toEqual(failureReasonLines('write-failed'));
});
