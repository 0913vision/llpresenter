import {
  parseLibrarySearchRequest,
  parseLibrarySearchResult,
  type LibrarySearchRequest,
  type LibrarySearchResult,
} from '@core/schema/librarySearch';
import {
  parseShowLibrarySongReply,
  parseShowLibrarySongRequest,
  type ShowLibrarySong,
  type ShowLibrarySongRequest,
} from '@core/schema/showLibrarySong';
import {
  parseTextImportClipboardAvailable,
  parseTextImportPreviewRequest,
  parseTextImportPreviewResult,
  parseTextImportReadRequest,
  parseTextImportReadResult,
  type TextImportPreviewRequest,
  type TextImportPreviewResult,
  type TextImportReadRequest,
  type TextImportReadResult,
} from '@core/schema/textImport';
import {Channels} from './channels';
import {query, request, type IpcPort} from './endpoint';

/** The calls that search the 라이브러리 and import songs from text. */
export const libraryEndpoints = {
  search: request<LibrarySearchRequest, LibrarySearchResult>(
    Channels.librarySearch,
    {request: parseLibrarySearchRequest, reply: parseLibrarySearchResult},
  ),
  showSong: request<ShowLibrarySongRequest, ShowLibrarySong | null>(
    Channels.libraryShowSong,
    {
      request: parseShowLibrarySongRequest,
      reply: (value, sent) => parseShowLibrarySongReply(sent.songId, value),
    },
  ),
  clipboardAvailable: query<boolean>(
    Channels.textImportClipboardAvailable,
    parseTextImportClipboardAvailable,
  ),
  readText: request<TextImportReadRequest, TextImportReadResult>(
    Channels.textImportRead,
    {request: parseTextImportReadRequest, reply: parseTextImportReadResult},
  ),
  previewText: request<TextImportPreviewRequest, TextImportPreviewResult>(
    Channels.textImportPreview,
    {
      request: parseTextImportPreviewRequest,
      reply: parseTextImportPreviewResult,
    },
  ),
};

/** The 라이브러리 part of `window.llp`. */
export function libraryApi(port: IpcPort) {
  return {
    /** Searches main's index; rejects and logs malformed requests or replies. */
    search: port.request(libraryEndpoints.search),
    /** Reads a 라이브러리 song as 진행 shows it, or `null` when it is gone. */
    showSong: port.request(libraryEndpoints.showSong),
  };
}

/** The text import part of `window.llp`. */
export function textImportApi(port: IpcPort) {
  return {
    /** Checks for usable clipboard text without opening or reserving a file read. */
    clipboardAvailable: port.query(libraryEndpoints.clipboardAvailable),
    /** Reads decoded text; a null success means the file dialog was cancelled. */
    read: port.request(libraryEndpoints.readText),
    /** Rebuilds an unsaved draft from retained text and options; never saves. */
    preview: port.request(libraryEndpoints.previewText),
  };
}

export type LibraryApi = ReturnType<typeof libraryApi>;
export type TextImportApi = ReturnType<typeof textImportApi>;
