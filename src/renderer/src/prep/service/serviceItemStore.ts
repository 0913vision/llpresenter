import type {LlpApi} from '@shared/ipc';
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import type {SongId} from '@shared/schema/ids';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {SongEditorStore} from '@renderer/prep/editor';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {
  updateServiceItem,
  type ServiceItemChange,
} from '@renderer/state/serviceItemUpdate';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export type ServiceItemApi = Pick<LlpApi, 'services' | 'songs' | 'content'>;

/** The 예배 순서 item that 준비 shows: its service and its id. */
export interface ItemTarget {
  readonly serviceId: string;
  readonly itemId: string;
}

export interface ServiceItemState {
  readonly service: ServiceDocument | null;
  readonly item: ServiceItem | null;
  /** The song of a song item, edited through the song editor's session. */
  readonly song: SongSession | null;
  readonly busy: boolean;
}

const NO_ITEM: ServiceItemState = {
  service: null,
  item: null,
  song: null,
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
  private serviceRead = 0;
  private busy = false;
  private alive = true;
  private state = NO_ITEM;

  constructor(
    private readonly api: ServiceItemApi,
    private readonly editor: SongEditorStore,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    this.stops = [
      api.services.subscribe(change =>
        this.acceptService(change.serviceId, change.document),
      ),
      editor.subscribe(() => this.publish()),
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
   * Gives the item's chosen 구성 a new order in the song file, so every 예배
   * 순서 that uses that 구성 shows it. 기본 has no order to change.
   */
  setOrder(slides: readonly number[]): boolean {
    const item = this.currentItem();
    const session = this.state.song;
    if (
      !this.alive ||
      session === null ||
      item === null ||
      !isItemOfKind(item, 'song') ||
      item.arrangement === undefined
    ) {
      return false;
    }
    return session.setArrangementSlides(item.arrangement, slides);
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
      this.problem('예배 순서 파일 저장 실패');
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
    } catch {
      if (read === this.serviceRead) {
        this.problem('예배 순서 불러오기 실패', () =>
          this.readService(serviceId),
        );
      }
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
    if (songId !== null && this.editor.sessionOf(songId) === undefined) {
      editorTask(this.readSong(songId));
    }
  }

  private async readSong(songId: SongId): Promise<void> {
    try {
      const document = await this.api.songs.get(songId);
      if (this.alive && this.songId === songId && document !== null) {
        this.editor.attach(document);
      }
    } catch {
      if (this.songId === songId) {
        this.problem('곡 불러오기 실패', () => this.readSong(songId));
      }
    }
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
    this.state = {
      service: this.service,
      item: this.currentItem(),
      song:
        this.songId === null
          ? null
          : (this.editor.sessionOf(this.songId) ?? null),
      busy: this.busy,
    };
    for (const listener of this.listeners) listener();
  }
}
