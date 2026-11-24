import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {TileCursor} from '@core/presentation';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import type {ShowService, ShowTile} from '@core/schema/services/showService';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {themeOfSlide} from '@core/theme';

const LOAD_DEADLINE_MS = 2000;
/** Open players are scarce, so only the next few videos stay loaded. */
const MAX_VIDEOS = 4;
const MAX_IMAGES = 60;

type Resource = HTMLImageElement | HTMLVideoElement;

/** The media a theme draws on a screen by itself. */
function themeMedia(theme: ThemeFile): readonly string[] {
  return [
    ...(theme.background.kind === 'media' ? [theme.background.media] : []),
    ...Object.values(theme.screens).flatMap(screen =>
      screen.mode === 'own'
        ? screen.elements.flatMap(element =>
            element.kind === 'picture' ? [element.media] : [],
          )
        : [],
    ),
  ];
}

/**
 * Keeps the media of the slides after the live one decoded, so the next slide
 * never waits for its background. It never changes the output.
 */
export class MediaPreloader {
  private service: ShowService | null = null;
  private media: MediaDocument | null = null;
  private themes: Themes | null = null;
  private live: TileCursor | null = null;
  private loading = false;
  private disposed = false;
  private readonly loaded = new Map<string, Resource>();
  private readonly failed = new Set<string>();
  private readonly stops: ReadonlyArray<() => void>;

  constructor(api: LlpApi) {
    this.stops = [
      api.service.subscribe(value => {
        this.service = value;
        this.follow();
      }),
      api.media.subscribe(value => {
        this.media = value;
        this.failed.clear();
        this.follow();
      }),
      api.settings.subscribe(value => {
        if (value.name !== 'themes') return;
        this.themes = value.value;
        this.follow();
      }),
    ];
    this.read(
      () => api.service.get(),
      value => (this.service ??= value),
    );
    this.read(
      () => api.media.get(),
      value => (this.media ??= value),
    );
    this.read(
      () => api.settings.get({name: 'themes'}),
      value => {
        if (value.name === 'themes') this.themes ??= value.value;
      },
    );
  }

  /** Goes on from the slide that is live now. */
  request(cursor: TileCursor): void {
    this.live = cursor;
    this.follow();
  }

  dispose(): void {
    this.disposed = true;
    for (const stop of this.stops) stop();
    for (const id of [...this.loaded.keys()]) this.drop(id);
  }

  private read<T>(get: () => Promise<T>, accept: (value: T) => void): void {
    get().then(
      value => {
        if (this.disposed) return;
        accept(value);
        this.follow();
      },
      () => undefined,
    );
  }

  private mediaOf({slide}: ShowTile): readonly string[] {
    const theme = themeOfSlide(this.themes, slide);
    return [
      ...(slide.background?.kind === 'media' ? [slide.background.media] : []),
      ...themeMedia(theme),
    ];
  }

  /** The media that come next, the soonest first. */
  private wanted(): readonly string[] {
    const {service, live} = this;
    if (service === null) return [];
    const at = Math.max(
      0,
      service.rows.findIndex(row => row.id === live?.itemId),
    );
    const rows = [...service.rows.slice(at), ...service.rows.slice(0, at)];
    const ids = rows.flatMap((row, index) => {
      const tiles = service.tiles[row.id] ?? [];
      const from =
        index === 0 && live?.itemId === row.id ? Math.max(0, live.index) : 0;
      return [...tiles.slice(from), ...tiles.slice(0, from)].flatMap(tile =>
        this.mediaOf(tile),
      );
    });
    let videos = 0;
    let images = 0;
    return [...new Set(ids)].filter(id =>
      this.kindOf(id) === 'video'
        ? ++videos <= MAX_VIDEOS
        : ++images <= MAX_IMAGES,
    );
  }

  private kindOf(id: string): 'video' | 'image' {
    const item = this.media?.value.items.find(entry => entry.id === id);
    return item?.kind === 'video' ? 'video' : 'image';
  }

  private follow(): void {
    if (this.disposed) return;
    const wanted = this.wanted();
    for (const id of [...this.loaded.keys()]) {
      if (!wanted.includes(id)) this.drop(id);
    }
    this.load(wanted);
  }

  private load(wanted: readonly string[]): void {
    if (this.loading) return;
    const id = wanted.find(
      entry => !this.loaded.has(entry) && !this.failed.has(entry),
    );
    if (id === undefined) return;
    this.loading = true;
    const next = (): void => {
      this.loading = false;
      this.follow();
    };
    this.warm(id).then(next, next);
  }

  private async warm(id: string): Promise<void> {
    const resource =
      this.kindOf(id) === 'video'
        ? document.createElement('video')
        : new Image();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready =
        resource instanceof HTMLVideoElement
          ? new Promise<void>((resolve, reject) => {
              resource.muted = true;
              resource.preload = 'auto';
              resource.onloadeddata = () => resolve();
              resource.onerror = () => reject(new Error('No video'));
              resource.src = mediaUrl(id);
              resource.load();
            })
          : ((resource.src = mediaUrl(id)), resource.decode());
      await Promise.race([
        ready,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Too slow')),
            LOAD_DEADLINE_MS,
          );
        }),
      ]);
      if (this.disposed) unload(resource);
      else this.loaded.set(id, resource);
    } catch {
      // NOTE(0913vision): The output itself handles missing or slow media.
      this.failed.add(id);
      unload(resource);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private drop(id: string): void {
    const resource = this.loaded.get(id);
    if (resource !== undefined) unload(resource);
    this.loaded.delete(id);
  }
}

function unload(resource: Resource): void {
  if (!(resource instanceof HTMLVideoElement)) return;
  resource.onloadeddata = null;
  resource.onerror = null;
  resource.pause();
  resource.removeAttribute('src');
  resource.load();
}
