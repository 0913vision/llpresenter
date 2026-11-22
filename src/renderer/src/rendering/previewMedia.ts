import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import type {MediaLayer} from '@core/live/state';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaProgress} from '@core/schema/mediaProgress';

const PREVIEW_IMAGE_BYTES = 128 * 1024 * 1024;
const PREVIEW_IMAGE_COUNT = 5000;
const temporaryImages = new Map<
  string,
  {url: string; size: number; users: number}
>();
let temporaryImageBytes = 0;

/** Lends a bounded, temporary image to preview renderers until released. */
export function lendPreviewImage(
  blob: Blob,
  contentHash?: string,
): {readonly id: string; readonly release: () => void} | null {
  const id = `preview:${contentHash ?? crypto.randomUUID()}`;
  const existing = temporaryImages.get(id);
  if (
    blob.size === 0 ||
    (existing === undefined &&
      (temporaryImages.size >= PREVIEW_IMAGE_COUNT ||
        temporaryImageBytes + blob.size > PREVIEW_IMAGE_BYTES))
  ) {
    return null;
  }
  if (existing === undefined) {
    const url = URL.createObjectURL(blob);
    temporaryImages.set(id, {url, size: blob.size, users: 1});
    temporaryImageBytes += blob.size;
  } else {
    existing.users++;
  }
  let released = false;
  return {
    id,
    release: () => {
      if (released) return;
      released = true;
      const image = temporaryImages.get(id);
      if (image === undefined) return;
      if (--image.users > 0) return;
      temporaryImages.delete(id);
      temporaryImageBytes -= image.size;
      URL.revokeObjectURL(image.url);
    },
  };
}

export interface PreviewMediaSource {
  /** The picture's address, when this window already knows it. */
  readonly peek: (mediaId: string) => string | undefined;
  readonly url: (mediaId: string) => Promise<string>;
  readonly remaining: (media: MediaLayer) => number | undefined;
}

/** Images keep their original pixels; a video shows its still. */
class PreviewMediaLibrary implements PreviewMediaSource {
  private items = new Map<string, MediaItem>();
  private revision = -1;
  private progress: MediaProgress | null = null;
  private unlock: () => void = () => undefined;
  private readonly ready = new Promise<void>(resolve => {
    this.unlock = resolve;
  });

  constructor(api: LlpApi) {
    api.media.subscribe(document => this.accept(document));
    api.media.get().then(
      document => this.accept(document),
      () => this.unlock(),
    );
    let pushed = false;
    api.live.subscribeMediaProgress(reading => {
      pushed = true;
      this.progress = reading;
    });
    api.live.mediaProgress().then(
      reading => {
        if (!pushed) this.progress = reading;
      },
      () => undefined,
    );
  }

  private accept(document: MediaDocument): void {
    if (document.revision <= this.revision) return;
    this.revision = document.revision;
    this.items = new Map(document.value.items.map(item => [item.id, item]));
    this.unlock();
  }

  peek(mediaId: string): string | undefined {
    const temporary = temporaryImages.get(mediaId);
    if (temporary !== undefined) return temporary.url;
    const item = this.items.get(mediaId);
    if (item === undefined || item.kind === 'audio') return undefined;
    return item.kind === 'video' ? thumbnailUrl(mediaId) : mediaUrl(mediaId);
  }

  async url(mediaId: string): Promise<string> {
    await this.ready;
    const url = this.peek(mediaId);
    if (url === undefined) {
      throw new Error('No preview picture for this media');
    }
    return url;
  }

  /** Live countdowns read main's samples; preparation stills keep their start. */
  remaining(media: MediaLayer): number | undefined {
    if (media.startedAt === 0) {
      const item = this.items.get(media.mediaId);
      return item?.kind === 'video' && item.duration !== undefined
        ? Math.max(0, item.duration - (media.positionSeconds ?? 0))
        : undefined;
    }
    const reading = this.progress;
    if (
      reading?.mediaId !== media.mediaId ||
      reading.startedAt !== media.startedAt ||
      reading.durationSeconds === null
    ) {
      return undefined;
    }
    return Math.max(0, reading.durationSeconds - reading.positionSeconds);
  }
}

const libraries = new WeakMap<LlpApi, PreviewMediaLibrary>();

/** The media this window draws, followed once for every picture in it. */
export function previewMediaOf(
  api: LlpApi | undefined,
): PreviewMediaSource | undefined {
  if (api === undefined) return undefined;
  let library = libraries.get(api);
  if (library === undefined) {
    library = new PreviewMediaLibrary(api);
    libraries.set(api, library);
  }
  return library;
}
