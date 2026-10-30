import type {MediaId} from '@core/schema/ids';
import {
  parseMediaDocument,
  parseMediaEdit,
  parseMediaEditResult,
  parseMediaImportProgress,
  parseMediaImportRequest,
  parseMediaImportResult,
  type MediaDocument,
  type MediaEdit,
  type MediaEditResult,
  type MediaImportProgress,
  type MediaImportRequest,
  type MediaImportResult,
} from '@core/schema/mediaEdit';
import {
  parseMediaCheckRequest,
  parseMediaRevealRequest,
  parseMissingMedia,
  type MissingMedia,
} from '@core/schema/mediaFiles';
import {Channels} from './channels';
import {
  message,
  push,
  query,
  request,
  type IpcPort,
  type WindowPlatform,
} from './endpoint';

/** A request about one media file. */
interface MediaFileRequest {
  readonly mediaId: MediaId;
}

/** The calls about the media list and its files. */
export const mediaEndpoints = {
  get: query<MediaDocument>(Channels.mediaGet, parseMediaDocument),
  edit: request<MediaEdit, MediaEditResult>(Channels.mediaEdit, {
    request: parseMediaEdit,
    reply: parseMediaEditResult,
  }),
  import: request<MediaImportRequest, MediaImportResult>(Channels.mediaImport, {
    request: parseMediaImportRequest,
    reply: parseMediaImportResult,
  }),
  changed: push<MediaDocument>(Channels.mediaChanged, parseMediaDocument),
  importChanged: push<MediaImportProgress>(
    Channels.mediaImportChanged,
    parseMediaImportProgress,
  ),
  missing: query<MissingMedia>(Channels.mediaMissingGet, parseMissingMedia),
  missingChanged: push<MissingMedia>(Channels.mediaMissing, parseMissingMedia),
  check: message<MediaFileRequest>(Channels.mediaCheck, parseMediaCheckRequest),
  reveal: message<MediaFileRequest>(
    Channels.mediaReveal,
    parseMediaRevealRequest,
  ),
};

/** The media part of `window.llp`. */
export function mediaApi(port: IpcPort, platform: WindowPlatform) {
  const check = port.message(mediaEndpoints.check);
  const reveal = port.message(mediaEndpoints.reveal);
  return {
    /** Reads a native dropped File's path, or an empty string when unavailable. */
    pathForFile: (file: File): string => platform.pathForFile(file),
    get: port.query(mediaEndpoints.get),
    edit: port.request(mediaEndpoints.edit),
    /** Starts copy jobs; an empty success means the file dialog was cancelled. */
    import: port.request(mediaEndpoints.import),
    /**
     * Follows the media list after applied edits, with its revision.
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(mediaEndpoints.changed),
    /**
     * Follows one copy job's progress, including failure and cancellation.
     * @returns A function that removes the listener. Always call it.
     */
    subscribeImports: port.subscribe(mediaEndpoints.importChanged),
    /**
     * Reads the media whose file main can't find now. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    missing: port.query(mediaEndpoints.missing),
    /**
     * Follows that set as main checks the files again.
     * @returns A function that removes the listener. Always call it.
     */
    subscribeMissing: port.subscribe(mediaEndpoints.missingChanged),
    /** Asks main to check one media file again, as after it failed to play. */
    check: (mediaId: MediaId): void => check({mediaId}),
    /** Shows the media file in Explorer (파일 위치 열기). */
    reveal: (mediaId: MediaId): void => reveal({mediaId}),
  };
}

export type MediaApi = ReturnType<typeof mediaApi>;
