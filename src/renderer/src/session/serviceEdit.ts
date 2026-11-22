import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {OpenServiceResult} from './openService';
import {orderFailureTitle} from './serviceOrderEdits';

export type Report = (notice: Notice) => void;

function reportEdit(result: OpenServiceResult, report: Report): void {
  if (result.ok) return;
  report({
    key: `slides:${result.error.reason}`,
    kind: 'warning',
    icon: 'warning',
    title:
      result.error.reason === 'write-failed'
        ? '예배 저장 실패'
        : orderFailureTitle(result.error, '슬라이드 변경 실패'),
    time: noticeTime(),
  });
}

/** Runs an edit of the open service and reports why it was refused. */
export function runEdit(
  edit: Promise<OpenServiceResult>,
  report: Report,
): void {
  edit.then(
    result => reportEdit(result, report),
    (error: unknown) => console.error('Could not change the service', error),
  );
}
