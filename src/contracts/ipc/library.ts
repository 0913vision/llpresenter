import {
  parseLibrarySearchRequest,
  parseLibrarySearchResult,
  type LibrarySearchRequest,
  type LibrarySearchResult,
} from '@core/schema/songs/librarySearch';
import {
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
  type ShowLibrarySong,
  type ShowLibrarySongRequest,
} from '@core/schema/songs/showLibrarySong';
import type {SongId} from '@core/schema/common/ids';
import {message, request, type IpcPort} from './endpoint';

/** The calls that search the 라이브러리 and show its songs. */
export const libraryEndpoints = {
  search: request<LibrarySearchRequest, LibrarySearchResult>('library:search', {
    request: parseLibrarySearchRequest,
    reply: parseLibrarySearchResult,
  }),
  showSong: request<ShowLibrarySongRequest, ShowLibrarySong | null>(
    'library:show-song',
    {
      request: parseShowLibrarySongRequest,
      reply: (value, sent) => parseShowLibrarySongReply(sent.songId, value),
    },
  ),
  revealSong: message<ShowLibrarySongRequest>(
    'library:reveal-song',
    parseShowLibrarySongRequest,
  ),
};

/** The 라이브러리 part of `window.llp`. */
export function libraryApi(port: IpcPort) {
  const revealSong = port.message(libraryEndpoints.revealSong);
  return {
    /** Searches main's index; rejects and logs malformed requests or replies. */
    search: port.request(libraryEndpoints.search),
    /** Reads a 라이브러리 song as 진행 shows it, or `null` when it is gone. */
    showSong: port.request(libraryEndpoints.showSong),
    /** Shows a song's file in the file manager; main finds it by id. */
    revealSong: (songId: SongId): void => revealSong({songId}),
  };
}

/** The 라이브러리 part of `window.llp` as the renderer sees it. */
export type LibraryApi = ReturnType<typeof libraryApi>;
