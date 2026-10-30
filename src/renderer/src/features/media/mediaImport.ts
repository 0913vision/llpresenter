import type {LlpApi} from '@contracts/ipc/api';
import type {
  MediaImportProgress,
  MediaImportRequest,
} from '@core/schema/mediaEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export function mediaImportFailureNotice(
  progress: MediaImportProgress,
): Notice | undefined {
  if (progress.phase !== 'failed') return undefined;
  return {
    key: `media-view:copy:${progress.mediaId}`,
    kind: 'warning',
    icon: 'warning',
    title: '미디어를 가져오지 못함',
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
  onProblem({
    key: 'media-view:import',
    kind: 'warning',
    icon: 'warning',
    title: '미디어를 가져올 수 없음',
    time: noticeTime(),
  });
  return null;
}
