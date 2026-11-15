import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {ShowService} from '@core/schema/showService';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {TileCursor} from '@core/presentation/model';
import type {ThemesFile} from '@core/schema/themes';
import {ServicePicturePreloader} from './servicePicturePreloader';

const LOAD_DEADLINE_MS = 2000;
type Resource = HTMLImageElement | HTMLVideoElement;

/** Keeps the service's slide media decoded without changing live output. */
export class ServiceMediaPreloader {
  private service: ShowService | null = null;
  private media: MediaDocument | null = null;
  private themes: ThemesFile | null = null;
  private generation = 0;
  private disposed = false;
  private readonly resources = new Map<string, Resource>();
  private readonly sizes = new Map<string, number>();
  private bytes = 0;
  private readonly plan = new ServicePicturePreloader(
    cursor => this.prepare(cursor),
    true,
  );
  private readonly stops: Array<() => void>;

  constructor(private readonly api: LlpApi) {
    let servicePush = false;
    let mediaPush = false;
    let themePush = false;
    this.stops = [
      api.service.subscribe(value => {
        servicePush = true;
        this.service = value;
        this.refresh();
      }),
      api.media.subscribe(value => {
        mediaPush = true;
        this.media = value;
        this.refresh();
      }),
      api.settings.subscribe(value => {
        if (value.name !== 'themes') return;
        themePush = true;
        this.themes = value.value;
        this.refresh();
      }),
    ];
    void api.service
      .get()
      .then(value => {
        if (!this.disposed && !servicePush) {
          this.service = value;
          this.refresh();
        }
      })
      .catch(() => undefined);
    void api.media
      .get()
      .then(value => {
        if (!this.disposed && !mediaPush) {
          this.media = value;
          this.refresh();
        }
      })
      .catch(() => undefined);
    void api.settings
      .get({name: 'themes'})
      .then(value => {
        if (!this.disposed && !themePush && value.name === 'themes') {
          this.themes = value.value;
          this.refresh();
        }
      })
      .catch(() => undefined);
  }

  request(cursor: TileCursor): void {
    const prepared = this.plan.get(cursor);
    if (prepared !== undefined) {
      const ids: unknown = JSON.parse(prepared);
      if (
        Array.isArray(ids) &&
        ids.some(id => typeof id === 'string' && !this.resources.has(id))
      ) {
        this.plan.invalidate(cursor);
      }
    }
    this.plan.request(cursor);
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    for (const stop of this.stops) stop();
    this.plan.dispose();
    this.clearResources();
  }

  private refresh(): void {
    this.generation++;
    this.clearResources();
    this.plan.refresh(this.service?.rows ?? [], this.service?.tiles ?? {});
  }

  private clearResources(): void {
    for (const id of this.resources.keys()) this.dropResource(id);
  }

  private dropResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource instanceof HTMLVideoElement) {
      resource.pause();
      resource.removeAttribute('src');
      resource.load();
    }
    this.bytes -= this.sizes.get(id) ?? 0;
    this.sizes.delete(id);
    this.resources.delete(id);
  }

  private async prepare(cursor: TileCursor): Promise<string | null> {
    const service = this.service;
    const row = service?.rows.find(value => value.id === cursor.itemId);
    const tile = service?.tiles[cursor.itemId]?.[cursor.index];
    if (!row || !tile || !this.media) return null;
    const ids = new Set<string>();
    if (tile.picture !== undefined) ids.add(tile.picture);
    if (tile.media !== undefined) ids.add(tile.media.mediaId);
    if ((row.kind === 'song' || row.kind === 'slides') && row.background) {
      ids.add(row.background.mediaId);
    }
    const kind = row.kind === 'slides' ? row.form : row.kind;
    const chosen =
      tile.sectionCard?.theme ??
      (row.kind === 'song' || row.kind === 'slides' ? row.theme : undefined) ??
      (row.kind === 'bible' ? row.bible?.theme : undefined) ??
      (kind === 'song' ||
      kind === 'bible' ||
      kind === 'blank' ||
      kind === 'ad' ||
      kind === 'media'
        ? this.themes?.defaults[kind]
        : undefined);
    const theme = this.themes?.themes.find(value => value.id === chosen);
    for (const layout of Object.values(theme?.screens ?? {})) {
      for (const element of layout.elements) {
        if (element.kind === 'image') ids.add(element.mediaId);
      }
    }
    const generation = this.generation;
    const ready = await Promise.all(
      [...ids].map(id => this.warm(id, generation)),
    );
    return generation === this.generation && ready.every(Boolean)
      ? JSON.stringify([...ids])
      : null;
  }

  private async warm(id: string, generation: number): Promise<boolean> {
    if (this.resources.has(id)) return true;
    const item = this.media?.value.items.find(value => value.id === id);
    if (!item || item.kind === 'audio') return false;
    const resource =
      item.kind === 'video' ? document.createElement('video') : new Image();
    const url = mediaUrl(id);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const loaded =
        resource instanceof HTMLVideoElement
          ? new Promise<void>((resolve, reject) => {
              resource.muted = true;
              resource.preload = 'auto';
              resource.onloadeddata = () => resolve();
              resource.onerror = () =>
                reject(new Error('Media preload failed'));
              resource.src = url;
              resource.load();
            })
          : (() => {
              resource.src = url;
              return resource.decode();
            })();
      await Promise.race([
        loaded,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Media preload timed out')),
            LOAD_DEADLINE_MS,
          );
        }),
      ]);
      if (this.disposed || generation !== this.generation) return false;
      const width =
        resource instanceof HTMLVideoElement
          ? resource.videoWidth
          : resource.naturalWidth;
      const height =
        resource instanceof HTMLVideoElement
          ? resource.videoHeight
          : resource.naturalHeight;
      const size = width * height * 4;
      this.resources.set(id, resource);
      this.sizes.set(id, size);
      this.bytes += size;
      return true;
    } catch {
      // NOTE(0913vision): The live renderer handles missing or slow assets.
      return false;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (resource instanceof HTMLVideoElement) {
        resource.onloadeddata = null;
        resource.onerror = null;
        if (this.resources.get(id) !== resource) {
          resource.removeAttribute('src');
          resource.load();
        }
      }
    }
  }
}
