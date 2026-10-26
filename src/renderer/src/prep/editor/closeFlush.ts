import type {AppFlushRequest} from '@shared/schema/appFlush';
import {closeStepAfter} from '@shared/closePolicy';
import type {LlpApi, Unsubscribe} from '@shared/ipc';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** The cause of the 그래도 닫기 warning; a later refusal replaces the card. */
export const CLOSE_WARNING_KEY = 'app:close-flush';

/** The arguments of {@link answerCloseFlush}. */
export interface CloseFlushOptions {
  readonly api: Pick<LlpApi, 'app' | 'log'>;
  /** Submits pending edits; true when nothing is left unsaved. */
  readonly flush: () => Promise<boolean>;
  readonly report: (notice: Notice) => void;
}

function closeWarning(api: CloseFlushOptions['api']): Notice {
  return {
    key: CLOSE_WARNING_KEY,
    kind: 'warning',
    icon: 'warning',
    title: '편집 내용 저장 실패',
    time: noticeTime(),
    actions: [
      {
        icon: 'x',
        label: '그래도 닫기',
        onSelect: () => {
          api.app.closeAnyway();
        },
      },
    ],
  };
}

function logError(
  api: CloseFlushOptions['api'],
  message: string,
  error: unknown,
): void {
  api.log.write({
    level: 'error',
    message,
    detail: error instanceof Error ? (error.stack ?? error.message) : '',
  });
}

async function flushed({api, flush}: CloseFlushOptions): Promise<boolean> {
  try {
    return await flush();
  } catch (error) {
    logError(api, 'could not flush the editor before closing', error);
    return false;
  }
}

async function answer(
  {requestId}: AppFlushRequest,
  options: CloseFlushOptions,
): Promise<void> {
  const result = await flushed(options);
  options.api.app.flushDone({requestId, result});
  if (closeStepAfter(result ? 'flushed' : 'refused') === 'warn') {
    options.report(closeWarning(options.api));
  }
}

/**
 * Answers main's request to flush before the control window closes with the
 * editor's flush result. When the shared close policy keeps the window open,
 * it reports a warning that offers 그래도 닫기.
 *
 * @returns A function that stops answering.
 */
export function answerCloseFlush(options: CloseFlushOptions): Unsubscribe {
  return options.api.app.subscribeFlushRequests(request => {
    answer(request, options).catch((error: unknown) => {
      logError(options.api, 'could not answer the close flush request', error);
    });
  });
}
