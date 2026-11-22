import {query, request, push, type IpcPort} from './endpoint';
import {
  parsePowerPointBackgroundsRequest,
  parsePowerPointBackgroundsResult,
  type PowerPointBackgroundsRequest,
  type PowerPointBackgroundsResult,
  parsePowerPointReadResult,
  parsePowerPointPreviewImage,
  type PowerPointPreviewImage,
  parsePowerPointReleaseRequest,
  parsePowerPointReleaseResult,
  parsePowerPointMatchResult,
  type PowerPointReadResult,
  type PowerPointReleaseRequest,
  parsePowerPointImageExportResult,
  parsePowerPointImageExportProgress,
  type PowerPointImageExportResult,
  type PowerPointImageExportProgress,
  parsePowerPointOwnedImagesRequest,
  parsePowerPointOwnedImagesResult,
  type PowerPointOwnedImagesRequest,
  type PowerPointOwnedImagesResult,
} from '@core/schema/powerpointImport';
import type {MediaId} from '@core/schema/ids';
export const powerpointEndpoints = {
  storeImages: request<
    PowerPointOwnedImagesRequest,
    PowerPointOwnedImagesResult
  >('import:powerpoint:images:store', {
    request: parsePowerPointOwnedImagesRequest,
    reply: parsePowerPointOwnedImagesResult,
  }),
  images: query<PowerPointImageExportResult>(
    'import:powerpoint:images',
    parsePowerPointImageExportResult,
  ),
  cancelImages: query<boolean>(
    'import:powerpoint:images:cancel',
    parsePowerPointReleaseResult,
  ),
  imageProgress: push<PowerPointImageExportProgress>(
    'import:powerpoint:images:progress',
    parsePowerPointImageExportProgress,
  ),
  cancelRead: query<boolean>(
    'import:powerpoint:read:cancel',
    parsePowerPointReleaseResult,
  ),
  read: query<PowerPointReadResult>(
    'import:powerpoint:read',
    parsePowerPointReadResult,
  ),
  backgrounds: request<
    PowerPointBackgroundsRequest,
    PowerPointBackgroundsResult
  >('import:powerpoint:backgrounds', {
    request: parsePowerPointBackgroundsRequest,
    reply: parsePowerPointBackgroundsResult,
  }),
  previewImage: request<PowerPointReleaseRequest, PowerPointPreviewImage>(
    'import:powerpoint:preview-image',
    {
      request: parsePowerPointReleaseRequest,
      reply: parsePowerPointPreviewImage,
    },
  ),
  release: request<PowerPointReleaseRequest, boolean>(
    'import:powerpoint:release',
    {
      request: parsePowerPointReleaseRequest,
      reply: parsePowerPointReleaseResult,
    },
  ),
  match: request<PowerPointReleaseRequest, MediaId | null>(
    'import:powerpoint:match',
    {request: parsePowerPointReleaseRequest, reply: parsePowerPointMatchResult},
  ),
};
export function powerpointApi(port: IpcPort) {
  return {
    storeImages: port.request(powerpointEndpoints.storeImages),
    images: port.query(powerpointEndpoints.images),
    cancelImages: port.query(powerpointEndpoints.cancelImages),
    subscribeImageProgress: port.subscribe(powerpointEndpoints.imageProgress),
    read: port.query(powerpointEndpoints.read),
    cancelRead: port.query(powerpointEndpoints.cancelRead),
    /** What is behind the texts of slides, as one picture file each. */
    backgrounds: port.request(powerpointEndpoints.backgrounds),
    previewImage: port.request(powerpointEndpoints.previewImage),
    release: port.request(powerpointEndpoints.release),
    match: port.request(powerpointEndpoints.match),
  };
}
export type PowerPointApi = ReturnType<typeof powerpointApi>;
