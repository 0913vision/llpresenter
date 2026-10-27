import type {MediaId} from '@shared/schema/ids';
import type {MediaImportProgress} from '@shared/schema/mediaEdit';
import {MEDIA_LIMITS} from '@shared/schema/mediaList';

export type CopyJob = Extract<
  MediaImportProgress,
  {phase: 'queued' | 'copying' | 'analysing'}
>;

/** Updates active jobs in place, allowing known jobs to advance at the cap. */
export function updateActiveCopies(
  jobs: Map<MediaId, CopyJob>,
  progress: MediaImportProgress,
): boolean {
  switch (progress.phase) {
    case 'queued':
    case 'copying':
    case 'analysing':
      if (!jobs.has(progress.mediaId) && jobs.size >= MEDIA_LIMITS.items) {
        return false;
      }
      jobs.set(progress.mediaId, progress);
      return true;
    case 'complete':
    case 'cancelled':
    case 'failed':
      return jobs.delete(progress.mediaId);
  }
}
