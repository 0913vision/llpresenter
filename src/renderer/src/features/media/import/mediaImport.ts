import type {LlpApi} from '@contracts/ipc/api';
import type {
  MediaImportProgress,
  MediaImportRequest,
} from '@core/schema/media/mediaEdit';
import {
  type Notice,
  noticeTime,
  warningNotice,
} from '@renderer/ui/popups/notices';

/** The warning for a failed import, or undefined for any other progress. */
export function mediaImportFailureNotice(
  progress: MediaImportProgress,
): Notice | undefined {
  if (progress.phase !== 'failed') return undefined;
  return {
    key: `media-view:copy:${progress.mediaId}`,
    kind: 'warning',
    icon: 'warning',
    title: '미디어 가져오기 실패',
    time: noticeTime(),
    meta: [progress.fileName, progress.message],
  };
}

/** Dispatches the same import command and refusal notice for every media surface. */
export async function requestMediaImport({
  api,
  source,
  playlist,
  onProblem,
}: {
  readonly api: Pick<LlpApi, 'media' | 'log'>;
  readonly source: MediaImportRequest['source'];
  readonly playlist: MediaImportRequest['playlist'];
  readonly onProblem: (notice: Notice) => void;
}): Promise<readonly MediaImportProgress[] | null> {
  const result = await api.media
    .import({source, playlist})
    .catch((error: unknown) => ({
      ok: false as const,
      error: {message: error instanceof Error ? error.message : String(error)},
    }));
  if (result.ok) return result.value;
  api.log.write({
    level: 'warn',
    message: 'Media import was refused',
    detail: result.error.message,
  });
  onProblem(warningNotice('media-view:import', '미디어 가져오기 실패'));
  return null;
}
