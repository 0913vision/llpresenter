import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';

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
        ? `예배 순서 ${unavailable ? '?' : '…'}`
        : `예배 순서 ${usedBy.length}곳`,
    tooltip:
      usedBy === undefined
        ? unavailable
          ? '곡 사용처 정보를 확인할 수 없습니다'
          : '사용처를 불러오는 중입니다'
        : usedBy.map(service => service.name).join(', ') ||
          '사용 중인 예배 순서 없음',
  };
}
