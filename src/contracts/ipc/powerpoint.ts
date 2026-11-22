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
  type PowerPointReadResult,
  type PowerPointReleaseRequest,
  parsePowerPointImageExportResult,
  parsePowerPointImageExportProgress,
  parsePowerPointReading,
  type PowerPointReading,
  type PowerPointImageExportResult,
  type PowerPointImageExportProgress,
  parsePowerPointOwnedImagesRequest,
  parsePowerPointOwnedImagesResult,
  type PowerPointOwnedImagesRequest,
  type PowerPointOwnedImagesResult,
} from '@core/schema/powerpointImport';
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
  /** A file was chosen and is being read. */
  reading: push<PowerPointReading>(
    'import:powerpoint:reading',
    parsePowerPointReading,
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
};
export function powerpointApi(port: IpcPort) {
  return {
    storeImages: port.request(powerpointEndpoints.storeImages),
    images: port.query(powerpointEndpoints.images),
    cancelImages: port.query(powerpointEndpoints.cancelImages),
    subscribeImageProgress: port.subscribe(powerpointEndpoints.imageProgress),
    read: port.query(powerpointEndpoints.read),
    subscribeReading: port.subscribe(powerpointEndpoints.reading),
    cancelRead: port.query(powerpointEndpoints.cancelRead),
    /** What is behind the texts of slides, as one picture file each. */
    backgrounds: port.request(powerpointEndpoints.backgrounds),
    previewImage: port.request(powerpointEndpoints.previewImage),
    release: port.request(powerpointEndpoints.release),
  };
}
export type PowerPointApi = ReturnType<typeof powerpointApi>;
