import {parsePictureRequest} from '@core/schema/pictureCopy';
import {pictureSize} from '@core/media/pictureSize';
import {coverCrop} from '@core/media/coverCrop';
import type {PictureRequest} from './pictureCache';

async function make(
  request: PictureRequest,
): Promise<{blob: Blob; width: number; height: number}> {
  const response = await fetch(request.source, {cache: 'no-store'});
  if (!response.ok) throw new Error('Could not read preview picture');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const crop =
      request.thumbnail === true
        ? coverCrop(bitmap, {width: 16, height: 9})
        : {x: 0, y: 0, width: bitmap.width, height: bitmap.height};
    const {width, height} = pictureSize(crop, request);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (context === null) throw new Error('Could not resize preview picture');
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height,
    );
    const blob = await canvas.convertToBlob({type: 'image/png'});
    return {
      blob,
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = parsePictureRequest(event.data);
  if (!parsed.ok) return;
  const {id, ...request} = parsed.value;
  make(request).then(
    picture => self.postMessage({id, picture}),
    (error: unknown) => {
      console.warn('Could not make preview picture', error);
      self.postMessage({id, picture: null});
    },
  );
});
