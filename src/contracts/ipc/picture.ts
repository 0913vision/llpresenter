import {
  parsePictureImage,
  parseOptionalPictureImage,
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
  peek: request<PictureRequest, Uint8Array | null>('picture:peek', {
    request: parsePictureRequest,
    reply: parseOptionalPictureImage,
  }),
  remember: message<PictureUpload>('picture:remember', parsePictureUpload),
  release: message<PictureRequest>('picture:release', parsePictureRequest),
  reserve: 'picture:reserve',
};

export function pictureApi(port: IpcPort) {
  const reserve: (request: PictureRequest) => boolean = () => false;
  return {
    paint: port.request(pictureEndpoints.paint),
    peek: port.request(pictureEndpoints.peek),
    remember: port.message(pictureEndpoints.remember),
    release: port.message(pictureEndpoints.release),
    reserve,
  };
}

export type PictureApi = ReturnType<typeof pictureApi>;
