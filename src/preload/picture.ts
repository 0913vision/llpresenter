import type {IpcPort} from '@contracts/ipc/endpoint';
import {pictureApi, pictureEndpoints} from '@contracts/ipc/picture';
import {parsePictureRequest, type PictureRequest} from '@core/schema/picture';

/** Reserves the editor's immediate draw before any other window can request it. */
export function picturePreload(
  port: IpcPort,
  ipc: {sendSync(channel: string, value: unknown): unknown},
) {
  return {
    ...pictureApi(port),
    reserve: (request: PictureRequest): boolean => {
      const parsed = parsePictureRequest(request);
      if (!parsed.ok) return false;
      try {
        return ipc.sendSync(pictureEndpoints.reserve, parsed.value) === true;
      } catch {
        return false;
      }
    },
  };
}
