import {parsePictureReply} from '@core/schema/pictureCopy';
import {
  PictureCache,
  type PictureRequest,
  type PictureCopy,
} from './pictureCache';

const IDLE_MS = 1000;
const DECODE_TIMEOUT_MS = 15_000;

/** Keeps small copies in the control window and releases the decoder between batches. */
export function openPictureCopies(): PictureCache {
  let worker: Worker | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;
  let settle: ((picture: PictureCopy | null) => void) | undefined;

  function closeWorker(): void {
    clearTimeout(idle);
    clearTimeout(deadline);
    worker?.terminate();
    worker = null;
    settle?.(null);
    settle = undefined;
  }

  function decoder(): Worker {
    if (worker !== null) return worker;
    worker = new Worker(new URL('./pictureWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<unknown>): void => {
      const parsed = parsePictureReply(event.data);
      if (!parsed.ok) {
        console.warn('Invalid preview picture reply');
        closeWorker();
        return;
      }
      if (parsed.value.id !== sequence) return;
      clearTimeout(deadline);
      const {picture} = parsed.value;
      settle?.(
        picture === null
          ? null
          : {
              url: URL.createObjectURL(picture.blob),
              bytes: picture.width * picture.height * 4 + picture.blob.size,
            },
      );
      settle = undefined;
      idle = setTimeout(closeWorker, IDLE_MS);
    };
    worker.onerror = (event): void => {
      console.error('Preview picture worker failed', event.message);
      closeWorker();
    };
    return worker;
  }

  const cache = new PictureCache({
    stamp: async source => {
      const response = await fetch(source, {method: 'HEAD', cache: 'no-store'});
      if (!response.ok) throw new Error('Could not read preview source');
      return response.headers.get('etag') ?? '';
    },
    make: async (request: PictureRequest) => {
      clearTimeout(idle);
      const active = decoder();
      const picture = await new Promise<PictureCopy | null>(resolve => {
        settle = resolve;
        active.postMessage({id: ++sequence, ...request});
        deadline = setTimeout(() => {
          console.warn('Preview picture decoding timed out');
          closeWorker();
        }, DECODE_TIMEOUT_MS);
      });
      if (picture === null) throw new Error('Could not decode preview picture');
      return picture;
    },
    release: url => URL.revokeObjectURL(url),
    stop: closeWorker,
  });
  return cache;
}
