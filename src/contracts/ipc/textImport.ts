import {
  parseTextImportClipboardAvailable,
  parseTextImportPreviewRequest,
  parseTextImportPreviewResult,
  parseTextImportReadRequest,
  parseTextImportReadResult,
  refuseInvalidTextImport,
  type TextImportPreviewRequest,
  type TextImportPreviewResult,
  type TextImportReadRequest,
  type TextImportReadResult,
} from '@core/schema/songs/textImport';
import {query, request, type IpcPort} from './endpoint';

/** The calls that read text into a new song. */
export const textImportEndpoints = {
  clipboardAvailable: query<boolean>(
    'import:text:clipboard-available:get',
    parseTextImportClipboardAvailable,
  ),
  readText: request<TextImportReadRequest, TextImportReadResult>(
    'import:text:read',
    {
      request: parseTextImportReadRequest,
      reply: parseTextImportReadResult,
      refuse: refuseInvalidTextImport,
    },
  ),
  previewText: request<TextImportPreviewRequest, TextImportPreviewResult>(
    'import:text:preview',
    {
      request: parseTextImportPreviewRequest,
      reply: parseTextImportPreviewResult,
      refuse: refuseInvalidTextImport,
    },
  ),
};

/** The text import part of `window.llp`. */
export function textImportApi(port: IpcPort) {
  return {
    /** Checks for usable clipboard text without opening or reserving a file read. */
    clipboardAvailable: port.query(textImportEndpoints.clipboardAvailable),
    /** Reads decoded text; a null success means the file dialog was cancelled. */
    read: port.request(textImportEndpoints.readText),
    /** Rebuilds an unsaved draft from retained text and options; never saves. */
    preview: port.request(textImportEndpoints.previewText),
  };
}

/** The text import part of `window.llp` as the renderer sees it. */
export type TextImportApi = ReturnType<typeof textImportApi>;
