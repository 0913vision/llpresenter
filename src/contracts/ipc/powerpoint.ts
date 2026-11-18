import {query, request, push, type IpcPort} from './endpoint';
import {
  parsePowerPointDecorationBatchRequest,
  parsePowerPointDecorationBatchResult,
  type PowerPointDecorationBatchRequest,
  type PowerPointDecorationBatchResult,
  parsePowerPointReadResult,
  parsePowerPointPreviewImage,
  type PowerPointPreviewImage,
  parsePowerPointBackgroundRequest,
  parsePowerPointBackgroundResult,
  parsePowerPointReleaseRequest,
  parsePowerPointReleaseResult,
  parsePowerPointMatchResult,
  type PowerPointReadResult,
  type PowerPointBackgroundRequest,
  type PowerPointReleaseRequest,
  parsePowerPointLayersRequest,
  parsePowerPointLayersResult,
  type PowerPointLayersRequest,
  type PowerPointSceneResult,
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
  layers: request<PowerPointLayersRequest, PowerPointSceneResult>(
    'import:powerpoint:layers',
    {request: parsePowerPointLayersRequest, reply: parsePowerPointLayersResult},
  ),
  cancelRead: query<boolean>(
    'import:powerpoint:read:cancel',
    parsePowerPointReleaseResult,
  ),
  read: query<PowerPointReadResult>(
    'import:powerpoint:read',
    parsePowerPointReadResult,
  ),
  background: request<PowerPointBackgroundRequest, string | null>(
    'import:powerpoint:background',
    {
      request: parsePowerPointBackgroundRequest,
      reply: parsePowerPointBackgroundResult,
    },
  ),
  decorationBatch: request<
    PowerPointDecorationBatchRequest,
    PowerPointDecorationBatchResult
  >('import:powerpoint:decoration-batch', {
    request: parsePowerPointDecorationBatchRequest,
    reply: parsePowerPointDecorationBatchResult,
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
    layers: port.request(powerpointEndpoints.layers),
    read: port.query(powerpointEndpoints.read),
    cancelRead: port.query(powerpointEndpoints.cancelRead),
    background: port.request(powerpointEndpoints.background),
    decorationBatch: port.request(powerpointEndpoints.decorationBatch),
    previewImage: port.request(powerpointEndpoints.previewImage),
    release: port.request(powerpointEndpoints.release),
    match: port.request(powerpointEndpoints.match),
  };
}
export type PowerPointApi = ReturnType<typeof powerpointApi>;
