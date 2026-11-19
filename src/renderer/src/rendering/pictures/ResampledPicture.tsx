import {useLayoutEffect, useRef, type JSX} from 'react';
import type {PictureImage} from './pictureService';
import styles from './Picture.module.css';

const pending = new Map<symbol, () => Promise<void>>();
let idle: number | undefined;
let resizing = false;

function scheduleResampling(): void {
  if (resizing || idle !== undefined || pending.size === 0) return;
  idle = requestIdleCallback(
    () => {
      idle = undefined;
      const next = pending.entries().next();
      if (next.done) return;
      const [tile, draw] = next.value;
      pending.delete(tile);
      resizing = true;
      void draw()
        .catch(() => undefined)
        .finally(() => {
          resizing = false;
          scheduleResampling();
        });
    },
    {timeout: 200},
  );
}

function cancelResampling(tile: symbol): void {
  pending.delete(tile);
  if (pending.size === 0 && idle !== undefined) {
    cancelIdleCallback(idle);
    idle = undefined;
  }
}

async function resizedPicture(
  source: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('bitmaprenderer');
  if (context === null) throw Error('Thumbnail canvas unavailable');
  const bitmap = await createImageBitmap(source, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  });
  context.transferFromImageBitmap(bitmap);
  return canvas.convertToBlob();
}

/** Samples the finished slide at the thumbnail's device pixel size. */
export function ResampledPicture({
  source,
  prepared,
}: {
  readonly source: PictureImage['source'];
  readonly prepared: HTMLImageElement | undefined;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const overlay = ref.current;
    const host = overlay?.parentElement;
    if (overlay === null || host == null) return;
    const image =
      typeof source === 'string'
        ? (prepared ?? host.querySelector('img'))
        : source;
    if (image === null) return;
    const tile = Symbol();
    let drawn = '';
    let revision = 0;
    let shownUrl: string | undefined;

    const swap = async (blob: Blob, turn: number): Promise<void> => {
      if (turn !== revision) return;
      const url = URL.createObjectURL(blob);
      const next = new Image();
      next.alt = '';
      next.draggable = false;
      next.src = url;
      try {
        await next.decode();
        if (turn !== revision) return;
        if (shownUrl !== undefined) URL.revokeObjectURL(shownUrl);
        shownUrl = url;
        overlay.replaceChildren(next);
        overlay.dataset['resampled'] = '';
      } finally {
        if (shownUrl !== url) URL.revokeObjectURL(url);
      }
    };

    const draw = (): void => {
      if (
        image instanceof HTMLImageElement &&
        (!image.complete || image.naturalWidth === 0)
      ) {
        return;
      }
      const bounds = host.getBoundingClientRect();
      const width = Math.round(bounds.width * window.devicePixelRatio);
      const height = Math.round(bounds.height * window.devicePixelRatio);
      const size = `${width}:${height}`;
      if (width < 1 || height < 1 || size === drawn) return;
      drawn = size;
      const turn = ++revision;
      pending.set(tile, async () =>
        swap(await resizedPicture(image, width, height), turn),
      );
      scheduleResampling();
    };
    draw();
    image.addEventListener('load', draw);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(draw);
    observer?.observe(host, {box: 'device-pixel-content-box'});
    return () => {
      revision++;
      cancelResampling(tile);
      image.removeEventListener('load', draw);
      observer?.disconnect();
      overlay.replaceChildren();
      delete overlay.dataset['resampled'];
      if (shownUrl !== undefined) URL.revokeObjectURL(shownUrl);
    };
  }, [source, prepared]);
  return <div ref={ref} className={styles.resampled} aria-hidden="true" />;
}
