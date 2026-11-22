import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {USAGE_LOADING, USAGE_UNAVAILABLE} from '@renderer/ui/usageText';

/** Formats usage from the editor's existing live library feed. */
export function songUsage(
  library: readonly LibrarySong[],
  status: 'loading' | 'ready' | 'failed',
  songId: SongId,
) {
  const usedBy = library.find(entry => entry.id === songId)?.usedBy;
  const unavailable = usedBy === undefined && status !== 'loading';
  return {
    unavailable,
    text:
      usedBy === undefined
        ? `예배 ${unavailable ? '?' : '…'}`
        : `예배 ${usedBy.length}곳`,
    tooltip:
      usedBy === undefined
        ? unavailable
          ? USAGE_UNAVAILABLE
          : USAGE_LOADING
        : usedBy.map(service => service.name).join(', ') || '쓰는 예배 없음',
  };
}
