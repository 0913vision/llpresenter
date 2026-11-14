import type {Label} from '@core/schema/labels';
import type {MediaChoice} from '@core/live/state';
import {isItemOfKind} from '@core/schema/service';
import type {MediaItem} from '@core/schema/mediaList';
import type {ShowService} from '@core/schema/showService';
import type {ContentStore} from './contentStore';
import {buildShowService, songBackgroundId} from './showService';
import {resolveServicePassages} from '../bible/servicePassages';
import type {BibleLookupSession} from '../bible/lookup';
import type {BibleProjectionPayload} from '@core/schema/bibleProjection';
import type {SettingsReader} from '@core/schema/settingsReader';
import type {ShowTile} from '@core/schema/showService';

const FIRST_REVISION = 1;

export interface OpenServiceSources {
  /** The 예배 순서 that 진행 opened, or `null` for none. */
  readonly serviceId: string | null;
  readonly labels: readonly Label[];
  readonly content: Pick<ContentStore, 'storedService' | 'storedSongs'>;
  readonly backgroundOf: (mediaId: string) => Promise<MediaChoice | null>;
  readonly bible?: Pick<BibleLookupSession, 'lookup'>;
  /** The media list, for the names of media items. */
  readonly mediaItems?: () => readonly MediaItem[];
  readonly settings?: SettingsReader | null;
}

function matchingVerses(
  original: readonly ShowTile[],
  parts: readonly ShowTile[],
): boolean {
  let index = 0;
  const content = (tile: ShowTile): string =>
    tile.lines.join('').replace(/\s|\(계속\)/gu, '');
  const verses = original.filter(tile => tile.sectionCard === undefined);
  for (const verse of verses) {
    let text = '';
    let count = 0;
    let continued = true;
    while (continued) {
      const part = parts[index++];
      if (
        !part ||
        part.sectionCard !== undefined ||
        part.biblePart !== ++count
      ) {
        return false;
      }
      text += content(part);
      continued = part.continued === true;
    }
    const full = content(verse);
    const number = verse.label?.match(/:(\d+)$/u)?.[1];
    if (
      text !== full &&
      !(verses.length === 1 && number !== undefined && full === number + text)
    ) {
      return false;
    }
  }
  return index === parts.length;
}

/**
 * The open 예배 순서 as 진행 shows it, built from the current content. When a
 * change alters what 진행 shows, such as a song's lyrics or the item order,
 * the next `ShowService` goes out one revision higher; a change that doesn't
 * alter it sends nothing.
 */
export class OpenServiceFeed {
  private revision = 0;
  private lastShown = JSON.stringify(null);
  private shown: ShowService | null = null;
  private pending = false;
  private refreshing: Promise<void> | null = null;
  private disposed = false;
  private initialized = false;
  private readonly bibleProjections = new Map<string, BibleProjectionPayload>();
  private originalTiles: ShowService['tiles'] = {};

  constructor(
    private readonly sources: OpenServiceSources,
    private readonly push: (service: ShowService | null) => void,
    private readonly reportError: (error: unknown) => void,
  ) {}

  current(): ShowService | null {
    return this.shown;
  }

  private validProjection(next: BibleProjectionPayload): boolean {
    const service =
      this.sources.serviceId === null
        ? undefined
        : this.sources.content.storedService(this.sources.serviceId);
    const item = service?.data.order.find(item => item.id === next.itemId);
    const settings = this.sources.settings;
    return (
      service?.data.id === next.serviceId &&
      service.revision === next.revision &&
      item !== undefined &&
      isItemOfKind(item, 'bible') &&
      settings?.get('themes').revision === next.measurement.themes &&
      settings.get('screens').revision === next.measurement.screens &&
      settings.get('bibleCuts').revision === next.measurement.bibleCuts
    );
  }

  acceptBibleProjection(next: BibleProjectionPayload): void {
    if (this.disposed || !this.validProjection(next)) return;
    const original = this.originalTiles[next.itemId];
    if (original === undefined || !matchingVerses(original, next.tiles)) return;
    if (
      JSON.stringify(this.bibleProjections.get(next.itemId)) ===
      JSON.stringify(next)
    ) {
      return;
    }
    this.bibleProjections.set(next.itemId, next);
    this.refresh().catch(this.reportError);
  }

  /** Rechecks background files and sends the projection only when it changed. */
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.pending = true;
    this.refreshing ??= this.flush().finally(() => {
      this.refreshing = null;
      return this.pending && !this.disposed ? this.refresh() : undefined;
    });
    return this.refreshing;
  }

  /** Stops pushes and awaits any file checks already in flight. */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.pending = false;
    await this.refreshing;
  }

  private async flush(): Promise<void> {
    while (this.pending && !this.disposed) {
      this.pending = false;
      try {
        const next = await this.build();
        if (!this.canPublish()) continue;
        const key = JSON.stringify(next);
        if (key === this.lastShown) {
          this.initialized = true;
          continue;
        }
        this.lastShown = key;
        this.revision++;
        this.shown = next === null ? null : {...next, revision: this.revision};
        if (this.initialized) this.push(this.shown);
        this.initialized = true;
      } catch (error: unknown) {
        this.reportError(error);
      }
    }
  }

  private canPublish(): boolean {
    return !this.pending && !this.disposed;
  }

  private async build(): Promise<ShowService | null> {
    const {serviceId, labels, content} = this.sources;
    const service =
      serviceId === null ? undefined : content.storedService(serviceId);
    if (service === undefined) {
      return null;
    }
    const songs = content.storedSongs();
    const checked = new Set<string>();
    const backgrounds = new Map<string, MediaChoice>();
    const media = this.sources.mediaItems;
    const mediaById =
      media === undefined
        ? undefined
        : new Map(media().map(item => [item.id, item]));
    const check = async (id: string | undefined): Promise<void> => {
      if (id === undefined || checked.has(id)) return;
      checked.add(id);
      const background = await this.sources.backgroundOf(id);
      if (background !== null) backgrounds.set(id, background);
    };
    for (const item of service.data.order) {
      if (isItemOfKind(item, 'slides')) {
        await check(item.background);
        continue;
      }
      if (isItemOfKind(item, 'media')) {
        await check(item.media);
        continue;
      }
      if (!isItemOfKind(item, 'song')) continue;
      const song = songs.get(item.song);
      if (song === undefined) continue;
      await check(songBackgroundId(item, song.data));
    }
    const built = buildShowService({
      service,
      serviceRevision: service.revision,
      songs,
      labels,
      revision: FIRST_REVISION,
      backgrounds,
      ...(mediaById === undefined ? {} : {media: mediaById}),
      ...(this.sources.bible === undefined
        ? {}
        : {
            passages: await resolveServicePassages(
              service.data.order,
              this.sources.bible,
              {
                reportError: this.reportError,
                isCurrent: () => this.canPublish(),
              },
            ),
          }),
    });
    this.originalTiles = built.tiles;
    const tiles = {...built.tiles};
    for (const [id, projection] of this.bibleProjections) {
      const original = tiles[id];
      if (
        !this.validProjection(projection) ||
        original === undefined ||
        !matchingVerses(original, projection.tiles)
      ) {
        this.bibleProjections.delete(id);
        continue;
      }
      const first = original[0];
      tiles[id] =
        first?.sectionCard === undefined
          ? projection.tiles
          : [first, ...projection.tiles];
    }
    return {...built, tiles};
  }
}
