import {query, request, push, type IpcPort} from './endpoint';
import {
  parsePowerPointReadResult,
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
} from '@core/schema/powerpointImport';
import type {MediaId} from '@core/schema/ids';
export const powerpointEndpoints = {
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
    images: port.query(powerpointEndpoints.images),
    cancelImages: port.query(powerpointEndpoints.cancelImages),
    subscribeImageProgress: port.subscribe(powerpointEndpoints.imageProgress),
    layers: port.request(powerpointEndpoints.layers),
    read: port.query(powerpointEndpoints.read),
    background: port.request(powerpointEndpoints.background),
    release: port.request(powerpointEndpoints.release),
    match: port.request(powerpointEndpoints.match),
  };
}
export type PowerPointApi = ReturnType<typeof powerpointApi>;
