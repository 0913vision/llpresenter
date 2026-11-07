import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import type {MediaLayer} from '@core/live/state';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaProgress} from '@core/schema/mediaProgress';

export interface PreviewMediaSource {
  readonly url: (mediaId: string) => Promise<string>;
  readonly remaining: (media: MediaLayer) => number | undefined;
}

/** Shares bounded media metadata and main's progress across a window's previews. */
class PreviewMediaLibrary implements PreviewMediaSource {
  private items = new Map<string, MediaItem>();
  private revision = -1;
  private stopped = false;
  private unlock: () => void = () => undefined;
  private readonly ready = new Promise<void>(resolve => {
    this.unlock = resolve;
  });
  private unsubscribe: (() => void) | undefined;
  private stopProgress: (() => void) | undefined;
  private progress: MediaProgress | null = null;
  private started = false;

  constructor(private readonly api: LlpApi) {}

  private start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const {api} = this;
    this.unsubscribe = api.media.subscribe(document => this.accept(document));
    api.media.get().then(
      document => this.accept(document),
      () => this.unlock(),
    );
    let pushed = false;
    this.stopProgress = api.live.subscribeMediaProgress(reading => {
      if (this.stopped) return;
      pushed = true;
      this.progress = reading;
    });
    api.live.mediaProgress().then(
      reading => {
        if (!this.stopped && !pushed) this.progress = reading;
      },
      () => undefined,
    );
  }

  private accept(document: MediaDocument): void {
    if (this.stopped || document.revision <= this.revision) return;
    this.revision = document.revision;
    this.items = new Map(document.value.items.map(item => [item.id, item]));
    this.unlock();
  }

  async url(mediaId: string): Promise<string> {
    this.start();
    await this.ready;
    const item = this.stopped ? undefined : this.items.get(mediaId);
    if (item === undefined || item.kind === 'audio') {
      throw new Error('No preview picture for this media');
    }
    return item.kind === 'video' ? thumbnailUrl(mediaId) : mediaUrl(mediaId);
  }

  /** Live countdowns read main's samples; preparation stills keep their start. */
  remaining(media: MediaLayer): number | undefined {
    this.start();
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

  dispose(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.stopProgress?.();
    this.progress = null;
    this.items.clear();
    this.unlock();
  }
}

const libraries = new WeakMap<
  LlpApi,
  {library: PreviewMediaLibrary; users: number}
>();

/** Images retain their original pixels; only videos use the media-bin still. */
export function openPreviewMedia(
  api: LlpApi | undefined,
): (PreviewMediaSource & {readonly dispose: () => void}) | undefined {
  if (api === undefined) return undefined;
  let shared = libraries.get(api);
  if (shared === undefined) {
    shared = {library: new PreviewMediaLibrary(api), users: 0};
    libraries.set(api, shared);
  }
  const entry = shared;
  entry.users++;
  let active = true;
  return {
    url: id => entry.library.url(id),
    remaining: media => entry.library.remaining(media),
    dispose: () => {
      if (!active) return;
      active = false;
      if (--entry.users === 0) {
        entry.library.dispose();
        libraries.delete(api);
      }
    },
  };
}
