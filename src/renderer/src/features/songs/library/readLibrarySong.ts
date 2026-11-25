import type {LlpApi} from '@contracts/ipc/api';
import type {SongId} from '@core/schema/common/ids';
import type {ShowLibrarySong} from '@core/schema/songs/showLibrarySong';
import {logFailure} from '@renderer/platform/logFailure';
import {warningNotice, type Notice} from '@renderer/ui/popups/notices';

/** The title of the card of a 라이브러리 song that could not be read. */
export const SONG_LOAD_FAILED = '곡 불러오기 실패';
/** The title of the card of a song that could not be opened in 준비. */
export const SONG_OPEN_FAILED = '곡 열기 실패';
/** What a 라이브러리 song that is not there says. */
export const SONG_NOT_FOUND = '곡을 찾을 수 없습니다.';

/** How a song that could not be read is reported. */
export interface SongReadReport {
  /** The key of its card: one card for each place that reads. */
  readonly key: string;
  readonly report: (notice: Notice) => void;
  /** Whether the answer is still wanted; when not, the failure is only logged. */
  readonly wanted?: () => boolean;
}

/**
 * Reads a song of the 라이브러리 as 진행 shows it. A song that cannot be read
 * is logged with its cause and reported while it is still wanted.
 *
 * @returns The song, null when the 라이브러리 has no song with this id, or
 *   undefined when it could not be read.
 */
export async function readLibrarySong(
  api: Pick<LlpApi, 'library' | 'log'>,
  songId: SongId,
  {key, report, wanted = () => true}: SongReadReport,
): Promise<ShowLibrarySong | null | undefined> {
  try {
    return await api.library.showSong({songId});
  } catch (cause) {
    logFailure(api, `Could not show library song ${songId}`, cause);
    if (wanted()) report(warningNotice(key, SONG_LOAD_FAILED));
    return undefined;
  }
}
