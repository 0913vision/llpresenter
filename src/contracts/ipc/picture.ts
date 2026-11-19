import {
  parsePictureImage,
  parsePictureRequest,
  parsePictureUpload,
  type PictureRequest,
  type PictureUpload,
} from '@core/schema/picture';
import {message, request, type IpcPort} from './endpoint';

/** Painter requests and their encoded image replies. */
export const pictureEndpoints = {
  paint: request<PictureRequest, Uint8Array>('picture:paint', {
    request: parsePictureRequest,
    reply: parsePictureImage,
  }),
  remember: message<PictureUpload>('picture:remember', parsePictureUpload),
};

export function pictureApi(port: IpcPort) {
  return {
    paint: port.request(pictureEndpoints.paint),
    remember: port.message(pictureEndpoints.remember),
  };
}

export type PictureApi = ReturnType<typeof pictureApi>;
