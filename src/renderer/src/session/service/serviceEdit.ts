import type {Notice} from '@renderer/ui/popups/notices';
import type {OpenServiceResult} from './openService';
import {serviceEditNotice} from './serviceProblem';

export type Report = (notice: Notice) => void;

function reportEdit(result: OpenServiceResult, report: Report): void {
  const notice = serviceEditNotice(result);
  if (notice !== null) report(notice);
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
