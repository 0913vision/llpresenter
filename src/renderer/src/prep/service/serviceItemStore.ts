import type {LlpApi} from '@shared/ipc';
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import type {SongId} from '@shared/schema/ids';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {Song} from '@shared/schema/song';
import type {SongEditorStore} from '@renderer/prep/editor';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {
  updateServiceItem,
  type ServiceItemChange,
} from '@renderer/state/serviceItemUpdate';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export type ServiceItemStoreApi = Pick<
  LlpApi,
  'services' | 'songs' | 'content'
>;

/** The 예배 순서 item that 준비 shows: its service and its id. */
export interface ItemTarget {
  readonly serviceId: string;
  readonly itemId: string;
}

/**
 * Where the song of a song item stands: being read, shown through its
 * session, gone from the 라이브러리, or not readable.
 */
export type ItemSongStatus = 'loading' | 'ready' | 'missing' | 'failed';

export interface ServiceItemState {
  readonly service: ServiceDocument | null;
  readonly item: ServiceItem | null;
  /** The song of a song item, edited through the song editor's session. */
  readonly song: SongSession | null;
  /** `null` when the item isn't a song item. */
  readonly songStatus: ItemSongStatus | null;
  /**
   * The 구성 the item plays: its `arrangement` while the song has a 구성 of
   * that name, else `undefined` for 기본 (spec 02).
   */
  readonly arrangement: string | undefined;
  readonly busy: boolean;
}

const NO_ITEM: ServiceItemState = {
  service: null,
  item: null,
  song: null,
  songStatus: null,
  arrangement: undefined,
  busy: false,
};

function sameTarget(left: ItemTarget | null, right: ItemTarget | null) {
  return left?.serviceId === right?.serviceId && left?.itemId === right?.itemId;
}

function withArrangement(
  item: ServiceItemOf<'song'>,
  name: string | undefined,
): ServiceItemOf<'song'> {
  if (item.arrangement === name) return item;
  const updated = {...item};
  if (name === undefined) delete updated.arrangement;
  else updated.arrangement = name;
  return updated;
}

function effectiveArrangement(
  item: ServiceItem | null,
  song: Song | undefined,
): string | undefined {
  if (item === null || !isItemOfKind(item, 'song') || song === undefined) {
    return undefined;
  }
  return song.arrangements?.some(entry => entry.name === item.arrangement) ===
    true
    ? item.arrangement
    : undefined;
}

/**
 * The 예배 순서 item selected in 준비. It follows the item's service file and,
 * for a song item, keeps the song's session in the song editor store, so the
 * window has one writer per song. Item edits go to the main process, and the
 * view changes when its answer comes back as a push.
 */
export class ServiceItemStore {
  private readonly listeners = new Set<() => void>();
  private readonly stops: ReadonlyArray<() => void>;
  private target: ItemTarget | null = null;
  private service: ServiceDocument | null = null;
  private songId: SongId | null = null;
  private songStatus: ItemSongStatus = 'loading';
  private serviceRead = 0;
  private songRead = 0;
  private busy = false;
  private alive = true;
  private state = NO_ITEM;

  constructor(
    private readonly api: ServiceItemStoreApi,
    private readonly editor: SongEditorStore,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    this.stops = [
      api.services.subscribe(change =>
        this.acceptService(change.serviceId, change.document),
      ),
      editor.subscribe(() => this.editorChanged()),
    ];
  }

  readonly getSnapshot = (): ServiceItemState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Shows an item, or nothing with `null`. Showing the same item does nothing. */
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

  /** Picks the item's 구성, or 기본 with `undefined`. */
  chooseArrangement(name: string | undefined): Promise<boolean> {
    return this.edit(
      item => (isItemOfKind(item, 'song') ? withArrangement(item, name) : null),
      '구성 변경 실패',
    );
  }

  /**
   * 새 구성: adds a 구성 to the song that copies the order the item plays,
   * saves the song, and then picks the new 구성 for the item.
   */
  async createArrangement(): Promise<boolean> {
    const {song, arrangement} = this.state;
    if (!this.alive || this.busy || song === null) return false;
    const name = song.copyArrangement(arrangement);
    if (name === undefined || !(await song.flush())) return false;
    return this.chooseArrangement(name);
  }

  /**
   * Gives the item's chosen 구성 a new order in the song file, so every 예배
   * 순서 that uses that 구성 shows it. 기본 has no order to change.
   */
  setOrder(slides: readonly number[]): boolean {
    const {song, arrangement} = this.state;
    if (!this.alive || song === null || arrangement === undefined) {
      return false;
    }
    return song.setArrangementSlides(arrangement, slides);
  }

  dispose(): void {
    this.alive = false;
    for (const stop of this.stops) stop();
    this.listeners.clear();
  }

  private async edit(
    change: ServiceItemChange,
    failure: string,
  ): Promise<boolean> {
    const target = this.target;
    if (!this.alive || this.busy || target === null) return false;
    this.setBusy(true);
    const result = await updateServiceItem(this.api, {...target, change});
    this.setBusy(false);
    if (result.ok) return true;
    if (result.error.reason === 'write-failed') {
      this.problem('예배 순서 저장 실패');
      return true;
    }
    this.problem(failure);
    return false;
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

  // NOTE(0913vision): A retry from an old notice must not start a read for a
  // service the store no longer shows, which would discard the current read.
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
    this.followSong();
    this.publish();
  }

  private currentItem(): ServiceItem | null {
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

  // NOTE(0913vision): Each read takes a new generation, and a change of song
  // takes one too, so only the newest read of the shown song may answer.
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

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.publish();
  }

  private problem(title: string, retry?: () => unknown): void {
    if (!this.alive) return;
    this.onProblem({
      key: `item:${this.target?.itemId}:${title}`,
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
      ...(retry === undefined
        ? {}
        : {
            actions: [
              {icon: 'refresh', label: '다시 불러오기', onSelect: retry},
            ],
          }),
    });
  }

  private publish(): void {
    if (!this.alive) return;
    const item = this.currentItem();
    const song =
      this.songId === null
        ? null
        : (this.editor.sessionOf(this.songId) ?? null);
    this.state = {
      service: this.service,
      item,
      song,
      songStatus: this.songId === null ? null : this.songStatus,
      arrangement: effectiveArrangement(item, song?.history.snapshot.song),
      busy: this.busy,
    };
    for (const listener of this.listeners) listener();
  }
}
