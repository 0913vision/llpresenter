import type {LlpApi} from '@shared/ipc';
import type {
  ServiceDocument,
  SongDocument,
} from '@shared/schema/contentDocuments';
import type {MediaId, SongGroupId, SongId} from '@shared/schema/ids';
import {isGroupedSong} from '@shared/schema/groupedSong';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {GroupedSong} from '@shared/schema/groupedSong';
import type {Song} from '@shared/schema/song';
import {editorTask} from '@renderer/prep/editor/editorTask';
import type {SongSession} from '@renderer/prep/editor/songSession';
import {backgroundChange} from '@renderer/state/serviceBackground';
import {
  pendingWritesOf,
  type PendingWrites,
} from '@renderer/state/pendingWrites';
import {
  updateServiceItem,
  itemArrangementChange,
  type ServiceItemChange,
} from '@renderer/state/serviceItemUpdate';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export type ServiceItemStoreApi = Pick<
  LlpApi,
  'services' | 'songs' | 'content'
>;

export interface ServiceItemEditor {
  sessionOf(id: SongId): SongSession | undefined;
  showItemSong(id: SongId | null): void;
  attach(document: SongDocument): SongSession | undefined;
  subscribe(listener: () => void): () => void;
}

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
  /**
   * The selected place in the order the item plays, shared by its chips,
   * thumbnails, and preview. Readers clamp it to the order's length.
   */
  readonly position: number;
  readonly busy: boolean;
}

const NO_ITEM: ServiceItemState = {
  service: null,
  item: null,
  song: null,
  songStatus: null,
  arrangement: undefined,
  position: 0,
  busy: false,
};

interface ItemEdit {
  readonly change: ServiceItemChange;
  readonly failure: string;
  readonly target: ItemTarget | null;
  readonly retry?: () => unknown;
}

// NOTE(0913vision): No text may vanish, so a draft is never dropped by age.
// Drafts are bounded by the items they were typed for; this limit only
// refuses a new draft when that many are still unsaved.
const MAX_MEMO_DRAFTS = 100;
const TOO_MANY_DRAFTS = '저장하지 못한 메모가 너무 많음';
const RETRY_READ_LABEL = '다시 불러오기';
const RETRY_SAVE_LABEL = '다시 저장';

function draftKey({serviceId, itemId}: ItemTarget): string {
  return `${serviceId}:${itemId}`;
}

function sameTarget(left: ItemTarget | null, right: ItemTarget | null) {
  return left?.serviceId === right?.serviceId && left?.itemId === right?.itemId;
}

const startKinds = ['song', 'bible', 'media', 'notice'] as const;
export type StartItem = ServiceItemOf<(typeof startKinds)[number]>;
type StartField = 'macro' | 'memo';

/** The items that run a start 매크로 and keep a memo (spec 02). */
export function isStartItem(item: ServiceItem): item is StartItem {
  return startKinds.some(kind => isItemOfKind(item, kind));
}

function setStartField(
  item: StartItem,
  field: StartField,
  value: string | undefined,
): StartItem {
  const updated = {...item};
  switch (field) {
    case 'macro':
      if (value === undefined) delete updated.macro;
      else updated.macro = value;
      break;
    case 'memo':
      if (value === undefined) delete updated.memo;
      else updated.memo = value;
      break;
  }
  return updated;
}

function withStartField(
  field: StartField,
  value: string | undefined,
): ServiceItemChange {
  return item => {
    if (!isStartItem(item)) return null;
    return item[field] === value ? item : setStartField(item, field, value);
  };
}

function effectiveArrangement(
  item: ServiceItem | null,
  song: Song | GroupedSong | undefined,
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
  private position = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private running = 0;
  private readonly memoDrafts = new Map<
    string,
    {readonly target: ItemTarget; readonly memo: string}
  >();
  private serviceRead = 0;
  private songRead = 0;
  private readonly writes: PendingWrites;
  private alive = true;
  private state = NO_ITEM;

  constructor(
    private readonly api: ServiceItemStoreApi,
    private readonly editor: ServiceItemEditor,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    this.writes = pendingWritesOf(api);
    this.stops = [
      this.writes.subscribe(() => this.publish()),
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
    this.position = 0;
    if (otherService) {
      this.service = null;
      if (target !== null) editorTask(this.readService(target.serviceId));
    }
    this.followSong();
    this.publish();
  }

  /** Selects a place in the order; nothing goes to the output. */
  selectPosition(index: number): void {
    if (!this.alive || !Number.isInteger(index) || index < 0) return;
    if (index === this.position) return;
    this.position = index;
    this.publish();
  }

  /** Picks the item's 구성, or 기본 with `undefined`. */
  chooseArrangement(name: string | undefined): Promise<boolean> {
    const target = this.target;
    return this.operation(() =>
      this.edit({
        change: itemArrangementChange(name),
        failure: '구성 변경 실패',
        target,
      }),
    );
  }

  /**
   * 새 구성: adds a 구성 to the song that copies the order the item plays,
   * saves the song, and then picks the new 구성 for the item.
   */
  createArrangement(name?: string): Promise<boolean> {
    const {song, arrangement} = this.state;
    const target = this.target;
    if (song === null || target === null) return Promise.resolve(false);
    return this.operation(() =>
      this.addArrangement({song, arrangement, target, name}),
    );
  }

  private async addArrangement({
    song,
    arrangement,
    target,
    name: requestedName,
  }: {
    readonly song: SongSession;
    readonly arrangement: string | undefined;
    readonly target: ItemTarget;
    readonly name: string | undefined;
  }): Promise<boolean> {
    if (!this.alive) return false;
    const songId = song.document.song.id;
    const name = song.copyArrangement(arrangement, requestedName);
    if (name === undefined || !(await song.flush())) return false;
    return this.edit({
      change: item =>
        isItemOfKind(item, 'song') && item.song === songId
          ? itemArrangementChange(name)(item)
          : null,
      failure: '구성 변경 실패',
      target,
    });
  }

  /** Writes a new group order into the current named arrangement. */
  setGroupOrder(order: readonly SongGroupId[]): boolean {
    const {song, arrangement} = this.state;
    if (
      !this.alive ||
      this.writes.isStopped ||
      song === null ||
      arrangement === undefined ||
      !isGroupedSong(song.history.snapshot.song)
    ) {
      return false;
    }
    return song.setArrangementGroups(arrangement, order);
  }

  /** Writes a new slide order into the current named arrangement. */
  setSlideOrder(order: readonly number[]): boolean {
    const {song, arrangement} = this.state;
    if (
      !this.alive ||
      this.writes.isStopped ||
      song === null ||
      arrangement === undefined ||
      isGroupedSong(song.history.snapshot.song)
    ) {
      return false;
    }
    return song.setArrangementSlides(arrangement, order);
  }

  /** Overrides the song's background for this item, or follows it with `null`. */
  setBackground(mediaId: MediaId | null): Promise<boolean> {
    const target = this.target;
    return this.operation(() =>
      this.edit({
        change: backgroundChange(mediaId),
        failure: '배경 변경 실패',
        target,
      }),
    );
  }

  /** The 매크로 that runs when the item starts, or none with `undefined`. */
  setStartMacro(macroId: string | undefined): Promise<boolean> {
    const target = this.target;
    return this.operation(() =>
      this.edit({
        change: withStartField('macro', macroId),
        failure: '시작 매크로 변경 실패',
        target,
      }),
    );
  }

  /**
   * Saves a memo to the item it was typed for, even when another item is
   * shown by then, after any edit in progress: the whole save, its wait
   * included, is registered with the pending writes at once. An empty memo
   * removes the field.
   */
  async setMemo(target: ItemTarget, memo: string): Promise<boolean> {
    if (!this.typeMemo(target, memo)) return false;
    return this.operation(() => this.saveMemo(target, memo));
  }

  /**
   * Keeps the text typed for an item as its draft, without saving yet, so a
   * close flush sees it before the typing pause ends. False when no draft
   * room is left.
   */
  typeMemo(target: ItemTarget, memo: string): boolean {
    return this.keepMemoDraft(draftKey(target), target, memo);
  }

  private async saveMemo(target: ItemTarget, memo: string): Promise<boolean> {
    const key = draftKey(target);
    const saved = await this.edit({
      change: withStartField('memo', memo === '' ? undefined : memo),
      failure: '메모 저장 실패',
      target,
      retry: () => this.retryMemo(target),
    });
    if (saved && this.memoDrafts.get(key)?.memo === memo) {
      this.memoDrafts.delete(key);
      this.publish();
    }
    return saved;
  }

  /** A memo typed for the item that isn't saved yet, kept until it is. */
  memoDraft(target: ItemTarget): string | undefined {
    return this.memoDrafts.get(draftKey(target))?.memo;
  }

  /** Whether a memo for the item can be kept if its save is refused. */
  hasMemoRoom(target: ItemTarget): boolean {
    return (
      this.memoDrafts.has(draftKey(target)) ||
      this.memoDrafts.size < MAX_MEMO_DRAFTS
    );
  }

  readonly memoRoomReason = TOO_MANY_DRAFTS;

  private keepMemoDraft(
    key: string,
    target: ItemTarget,
    memo: string,
  ): boolean {
    if (!this.memoDrafts.has(key) && this.memoDrafts.size >= MAX_MEMO_DRAFTS) {
      this.problem(TOO_MANY_DRAFTS);
      return false;
    }
    this.memoDrafts.set(key, {target, memo});
    this.publish();
    return true;
  }

  // NOTE(0913vision): A draft goes with its item when the service no longer
  // has it; no other draft is ever dropped.
  private forgetDeletedDrafts(
    serviceId: string,
    document: ServiceDocument | null,
  ): void {
    const kept = new Set<string>(document?.service.order.map(item => item.id));
    for (const [key, {target}] of this.memoDrafts) {
      if (target.serviceId === serviceId && !kept.has(target.itemId)) {
        this.memoDrafts.delete(key);
      }
    }
  }

  private retryMemo(target: ItemTarget): void {
    const memo = this.memoDraft(target);
    if (memo !== undefined) editorTask(this.setMemo(target, memo));
  }

  dispose(): void {
    this.alive = false;
    for (const stop of this.stops) stop();
    this.listeners.clear();
  }

  // NOTE(0913vision): Every item edit goes through the window's pending
  // writes, so the close flush stops new ones, waits for the running ones,
  // and refuses the close when one didn't reach the main process. Edits run
  // one after another and none is refused for another one running; a queued
  // edit is registered before it waits.
  private operation(task: () => Promise<boolean>): Promise<boolean> {
    if (!this.alive) return Promise.resolve(false);
    return this.writes.run({
      write: () => this.queued(task),
      refused: false,
      sent: sent => sent,
    });
  }

  private queued(task: () => Promise<boolean>): Promise<boolean> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * The store's part of the close flush: saves every memo that is still
   * waiting after the running edits, and answers whether none is left.
   */
  async flushDrafts(): Promise<boolean> {
    await this.queue;
    const saved = await Promise.all(
      [...this.memoDrafts.values()].map(({target, memo}) =>
        this.queued(() => this.saveMemo(target, memo)),
      ),
    );
    return saved.every(Boolean) && this.memoDrafts.size === 0;
  }

  private async edit({
    change,
    failure,
    target,
    retry,
  }: ItemEdit): Promise<boolean> {
    if (!this.alive || target === null) return false;
    this.setRunning(1);
    const result = await updateServiceItem(this.api, {...target, change});
    this.setRunning(-1);
    if (result.ok) return true;
    if (result.error.reason === 'write-failed') {
      this.problem('예배 순서 저장 실패');
      return true;
    }
    this.problem(failure, retry, RETRY_SAVE_LABEL);
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
    this.forgetDeletedDrafts(serviceId, document);
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

  private setRunning(change: 1 | -1): void {
    this.running += change;
    this.publish();
  }

  private problem(
    title: string,
    retry?: () => unknown,
    retryLabel = RETRY_READ_LABEL,
  ): void {
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
            actions: [{icon: 'refresh', label: retryLabel, onSelect: retry}],
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
      position: this.position,
      busy: this.running > 0 || this.writes.isStopped,
    };
    for (const listener of this.listeners) listener();
  }
}
