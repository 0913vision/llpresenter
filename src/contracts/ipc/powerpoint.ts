import {query, request, type IpcPort} from './endpoint';
import {
  parsePowerPointReadResult,
  parsePowerPointBackgroundRequest,
  parsePowerPointBackgroundResult,
  parsePowerPointReleaseRequest,
  parsePowerPointReleaseResult,
  type PowerPointReadResult,
  type PowerPointBackgroundRequest,
  type PowerPointReleaseRequest,
} from '@core/schema/powerpointImport';
export const powerpointEndpoints = {
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
};
export function powerpointApi(port: IpcPort) {
  return {
    read: port.query(powerpointEndpoints.read),
    background: port.request(powerpointEndpoints.background),
    release: port.request(powerpointEndpoints.release),
  };
}
export type PowerPointApi = ReturnType<typeof powerpointApi>;
