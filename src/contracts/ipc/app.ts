import {
  parseAppFlushDone,
  parseAppFlushRequest,
  parseAppSavePendingResult,
  type AppFlushDone,
  type AppFlushRequest,
} from '@core/schema/appFlush';
import {
  parseAppProblem,
  parseAppProblems,
  type AppProblem,
} from '@core/schema/appProblem';
import {message, push, query, signal, type IpcPort} from './endpoint';

/** The calls that close the app safely and report its problems. */
export const appEndpoints = {
  savePending: query<boolean>('app:save-pending', parseAppSavePendingResult),
  flushProgress: message<AppFlushRequest>(
    'app:flush-progress',
    parseAppFlushRequest,
  ),
  flushRequests: push<AppFlushRequest>(
    'app:flush-request',
    parseAppFlushRequest,
  ),
  flushDone: message<AppFlushDone>('app:flush-done', parseAppFlushDone),
  closeAnyway: signal('app:close-anyway'),
  problemList: query<readonly AppProblem[]>(
    'app:problem:list',
    parseAppProblems,
  ),
  problems: push<AppProblem>('app:problem', parseAppProblem),
  retrySaves: signal('app:problem:retry-saves'),
};

/** The closing part of `window.llp`. */
export function appApi(port: IpcPort) {
  return {
    /** Returns a function that removes the control window's flush listener. */
    subscribeFlushRequests: port.subscribe(appEndpoints.flushRequests),
    /** Replies with the editor's flush result for one request. */
    flushDone: port.message(appEndpoints.flushDone),
    /** Keeps the close request alive while the responsive window awaits saves. */
    flushProgress: port.message(appEndpoints.flushProgress),
    /** Writes accepted edits to disk; false while any file remains unsaved. */
    savePending: port.query(appEndpoints.savePending),
    /**
     * 강제로 닫기: closes the control window without waiting for its flush, or
     * without another one after main kept it open for a refusal. Main ignores
     * it at any other time.
     */
    closeAnyway: port.signal(appEndpoints.closeAnyway),
  };
}

/** The problems part of `window.llp`. */
export function problemsApi(port: IpcPort) {
  return {
    /**
     * Reads what a window that loads late must show: the standing problems,
     * such as files skipped at startup, then, once, the newest one-shot
     * problems that no window has read yet (at most 16), such as a
     * `macro-dropped` from a startup 매크로. The read clears those, so
     * subscribe first and then list, and nothing falls between the two.
     * Rejects, after logging, when the call fails or the answer is malformed.
     */
    list: port.query(appEndpoints.problemList),
    /**
     * Calls the listener for each problem main reports for a notification
     * card, such as 매크로 적용 실패.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(appEndpoints.problems),
    /**
     * 다시 시도 of 저장할 수 없음: writes every waiting file again at once. A
     * later push says how it went.
     */
    retrySaves: port.signal(appEndpoints.retrySaves),
  };
}

export type AppApi = ReturnType<typeof appApi>;
export type ProblemsApi = ReturnType<typeof problemsApi>;
