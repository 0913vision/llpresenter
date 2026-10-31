import type {LlpApi} from '@contracts/ipc/api';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ItemProblem, ItemTarget} from './itemEditQueue';
/** The existing service, song and content ports shared by the facade collaborators. */
export type ServiceItemStoreApi = Pick<
  LlpApi,
  'services' | 'songs' | 'content'
>;
/** Borrows the editor-owned song session rather than creating a second writer. */
export interface ServiceItemEditor {
  sessionOf(id: SongId): SongSession | undefined;
  showItemSong(id: SongId | null): void;
  attach(document: SongDocument): SongSession | undefined;
  subscribe(listener: () => void): () => void;
}
/**
 * Where the song of a song item stands: being read, shown through its
 * session, gone from the 라이브러리, or not readable.
 */
export type ItemSongStatus = 'loading' | 'ready' | 'missing' | 'failed';
/** The followed documents and the exact editor session they currently resolve to. */
export interface ItemSourceSnapshot {
  readonly service: ServiceDocument | null;
  readonly item: ServiceItem | null;
  readonly song: SongSession | null;
  readonly songStatus: ItemSongStatus | null;
}
/** Service acceptance precedes song following and publication; failures use the facade's notice context. */
export interface ItemSourceEvents {
  readonly problem: ItemProblem;
  readonly accepted: (
    serviceId: string,
    document: ServiceDocument | null,
  ) => void;
}
/** Compares the selected service/item pair, including the empty selection. */
export function sameTarget(left: ItemTarget | null, right: ItemTarget | null) {
  return left?.serviceId === right?.serviceId && left?.itemId === right?.itemId;
}
/** Follows one selected item's service and song with the existing generation guards. */
export class ItemSourceFollower {
  private readonly listeners = new Set<() => void>();
  private stops: ReadonlyArray<() => void> = [];
  private target: ItemTarget | null = null;
  private service: ServiceDocument | null = null;
  private songId: SongId | null = null;
  private songStatus: ItemSongStatus = 'loading';
  private serviceRead = 0;
  private songRead = 0;
  private alive = true;
  /** The acceptance hook runs before following the service's song or publishing it. */
  constructor(
    private readonly api: ServiceItemStoreApi,
    private readonly editor: ServiceItemEditor,
    private readonly events: ItemSourceEvents,
  ) {}
  /** Starts the original feeds once after the facade has connected all collaborators. */
  start(): void {
    this.stops = [
      this.api.services.subscribe(change =>
        this.acceptService(change.serviceId, change.document),
      ),
      this.editor.subscribe(() => this.editorChanged()),
    ];
  }
  /** Captures current document and session references at the facade's publication time. */
  snapshot(): ItemSourceSnapshot {
    return {
      service: this.service,
      item: this.currentItem(),
      song:
        this.songId === null
          ? null
          : (this.editor.sessionOf(this.songId) ?? null),
      songStatus: this.songId === null ? null : this.songStatus,
    };
  }
  /** Follows the same read, push and editor-change publication points as the facade. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Follows another captured target, or nothing; the same target is unchanged. */
  show(target: ItemTarget | null): void {
    if (!this.alive || sameTarget(target, this.target)) return;
    const otherService = target?.serviceId !== this.target?.serviceId;
    this.target = target;
    if (otherService) {
      this.service = null;
      if (target !== null) editorTask(this.readService(target.serviceId));
    }
    this.followSong();
    this.publish();
  }
  private async readService(serviceId: string): Promise<void> {
    const read = ++this.serviceRead;
    try {
      const document = await this.api.services.get(serviceId);
      if (read === this.serviceRead) this.acceptService(serviceId, document);
    } catch (error) {
      console.error('Could not read the service of the item', error);
      if (read === this.serviceRead) {
        this.problem('예배 순서 불러오기 실패', () =>
          this.retryService(serviceId),
        );
      }
    }
  }
  private retryService(serviceId: string): void {
    if (this.alive && this.target?.serviceId === serviceId) {
      editorTask(this.readService(serviceId));
    }
  }
  private acceptService(
    serviceId: string,
    document: ServiceDocument | null,
  ): void {
    if (!this.alive || this.target?.serviceId !== serviceId) return;
    if (
      document !== null &&
      this.service !== null &&
      document.revision <= this.service.revision
    ) {
      return;
    }
    this.service = document;
    this.events.accepted(serviceId, document);
    this.followSong();
    this.publish();
  }
  /** Reads the current item without resolving or replacing its song session. */
  currentItem(): ServiceItem | null {
    const itemId = this.target?.itemId;
    return this.service?.service.order.find(row => row.id === itemId) ?? null;
  }
  private followSong(): void {
    const item = this.currentItem();
    const songId =
      item !== null && isItemOfKind(item, 'song') ? item.song : null;
    if (songId === this.songId) return;
    this.songId = songId;
    this.songRead++;
    this.editor.showItemSong(songId);
    if (songId === null) return;
    if (this.editor.sessionOf(songId) === undefined) this.loadSong(songId);
    else this.songStatus = 'ready';
  }
  private editorChanged(): void {
    if (
      this.songId !== null &&
      this.songStatus === 'ready' &&
      this.editor.sessionOf(this.songId) === undefined
    ) {
      this.loadSong(this.songId);
    }
    this.publish();
  }
  private loadSong(songId: SongId): void {
    this.songStatus = 'loading';
    editorTask(this.readSong(songId, ++this.songRead));
  }
  private async readSong(songId: SongId, read: number): Promise<void> {
    const current = (): boolean => this.alive && read === this.songRead;
    try {
      const document = await this.api.songs.get(songId);
      if (!current()) return;
      this.songStatus = document === null ? 'missing' : 'ready';
      if (document !== null) this.editor.attach(document);
      this.publish();
    } catch (error) {
      console.error('Could not read the song of the item', error);
      if (!current()) return;
      this.songStatus = 'failed';
      this.publish();
      this.problem('곡 불러오기 실패', () => this.retrySong(songId));
    }
  }
  private retrySong(songId: SongId): void {
    if (!this.alive || this.songId !== songId) return;
    this.loadSong(songId);
    this.publish();
  }
  private problem(...args: Parameters<ItemProblem>): void {
    if (this.alive) this.events.problem(...args);
  }
  private publish(): void {
    if (!this.alive) return;
    for (const listener of this.listeners) listener();
  }
  /** Releases both source feeds and prevents delayed reads from publishing. */
  dispose(): void {
    this.alive = false;
    for (const stop of this.stops) stop();
    this.listeners.clear();
  }
}
