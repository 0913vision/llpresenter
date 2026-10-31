import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {ItemOverlayId, MediaId, ThemeId} from '@core/schema/ids';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {ServiceItem} from '@core/schema/service';
import {effectiveArrangement} from '@core/services/itemFieldChanges';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  ItemEditQueue,
  type ItemEditRequest,
  type ItemTarget,
} from './itemEditQueue';
import {ItemMemoDrafts, TOO_MANY_DRAFTS} from './itemMemoDrafts';
import {
  ItemSourceFollower,
  sameTarget,
  type ServiceItemStoreApi,
  type ServiceItemEditor,
  type ItemSongStatus,
} from './itemSourceFollower';
import {
  arrangementRequest,
  backgroundRequest,
  startMacroRequest,
} from './itemPlaybackCommands';
import {themeRequest, overlayRequest} from './itemAppearanceCommands';
export type {ServiceItemChange} from '@core/services/itemFieldChanges';
export {
  isStartItem,
  withStartField,
  effectiveArrangement,
  type StartItem,
} from '@core/services/itemFieldChanges';
export type {ItemTarget} from './itemEditQueue';
export type {
  ServiceItemStoreApi,
  ServiceItemEditor,
  ItemSongStatus,
} from './itemSourceFollower';
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
  readonly overlay: ItemOverlayId | null;
  readonly busy: boolean;
}
const NO_ITEM: ServiceItemState = {
  service: null,
  item: null,
  song: null,
  songStatus: null,
  arrangement: undefined,
  position: 0,
  overlay: null,
  busy: false,
};
const RETRY_READ_LABEL = '다시 불러오기';

/**
 * The 예배 순서 item selected in 준비. It follows the item's service file and,
 * for a song item, keeps the song's session in the song editor store, so the
 * window has one writer per song. Item edits go to the main process, and the
 * view changes when its answer comes back as a push.
 */

export class ServiceItemStore {
  private readonly listeners = new Set<() => void>();
  private readonly edits: ItemEditQueue;
  private readonly memos: ItemMemoDrafts;
  private readonly source: ItemSourceFollower;
  private readonly stopWrites: () => void;
  private target: ItemTarget | null = null;
  private position = 0;
  private overlay: ItemOverlayId | null = null;
  private alive = true;
  private state = NO_ITEM;
  readonly memoRoomReason = TOO_MANY_DRAFTS;
  constructor(
    api: ServiceItemStoreApi,
    editor: ServiceItemEditor,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    const problem = this.problem.bind(this);
    this.edits = new ItemEditQueue(api, problem);
    this.memos = new ItemMemoDrafts(this.edits, () => this.publish(), problem);
    this.source = new ItemSourceFollower(api, editor, {
      problem,
      accepted: (id, document) => this.memos.forgetDeleted(id, document),
    });
    this.stopWrites = this.edits.subscribe(() => this.publish());
    this.source.subscribe(() => this.publish());
    this.source.start();
  }
  readonly getSnapshot = (): ServiceItemState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** Shows an item, or nothing with null. Showing the same item does nothing. */
  show(target: ItemTarget | null): void {
    if (!this.alive || sameTarget(target, this.target)) return;
    this.target = target;
    this.position = 0;
    this.overlay = null;
    this.source.show(target);
  }
  /** Selects a place in the order without changing the output. */
  selectPosition(index: number): void {
    if (!this.alive || !Number.isInteger(index) || index < 0) return;
    if (index === this.position) return;
    this.position = index;
    this.publish();
  }
  /** Submits a captured field request through the single item-write queue. */
  submitItemEdit(request: ItemEditRequest): Promise<boolean> {
    return this.edits.submit(request);
  }
  /** Picks the item's arrangement, or 기본 when omitted. */
  chooseArrangement(name: string | undefined): Promise<boolean> {
    return this.submitItemEdit(arrangementRequest(this.target, name));
  }
  selectOverlay(id: ItemOverlayId | null): void {
    if (!this.alive || this.overlay === id) return;
    if (
      id !== null &&
      !this.source.currentItem()?.overlays?.some(row => row.id === id)
    ) {
      return;
    }
    this.overlay = id;
    this.publish();
  }
  /** Omitting the theme follows the item's kind default. */
  setTheme(theme: ThemeId | undefined): Promise<boolean> {
    return this.submitItemEdit(themeRequest(this.target, theme));
  }
  /** Applies an overlay edit to the fresh captured item. */
  changeOverlays(
    change: (rows: readonly ItemOverlay[]) => readonly ItemOverlay[],
    target: ItemTarget | null = this.target,
  ): Promise<boolean> {
    return this.submitItemEdit(overlayRequest(target, change));
  }
  /** Overrides the song background for this item, or follows it with null. */
  setBackground(mediaId: MediaId | null): Promise<boolean> {
    return this.submitItemEdit(backgroundRequest(this.target, mediaId));
  }
  /** Sets the start macro, or removes it when omitted. */
  setStartMacro(macroId: string | undefined): Promise<boolean> {
    return this.submitItemEdit(startMacroRequest(this.target, macroId));
  }
  /** Saves text to its captured item after earlier edits, retaining refused drafts. */
  setMemo(target: ItemTarget, memo: string): Promise<boolean> {
    return this.memos.save(target, memo);
  }
  /** Keeps typed text visible to close preflight without sending it yet. */
  typeMemo(target: ItemTarget, memo: string): boolean {
    return this.memos.type(target, memo);
  }
  /** Reads a retained draft for one captured item. */
  memoDraft(target: ItemTarget): string | undefined {
    return this.memos.get(target);
  }
  /** Whether this item's draft fits within the unsaved-item cap. */
  hasMemoRoom(target: ItemTarget): boolean {
    return this.memos.hasRoom(target);
  }
  /** Saves all retained drafts after running edits, including during close preflight. */
  flushDrafts(): Promise<boolean> {
    return this.memos.flush();
  }
  dispose(): void {
    this.alive = false;
    this.stopWrites();
    this.edits.dispose();
    this.source.dispose();
    this.listeners.clear();
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
    const {service, item, song, songStatus} = this.source.snapshot();
    if (
      this.overlay !== null &&
      !item?.overlays?.some(row => row.id === this.overlay)
    ) {
      this.overlay = null;
    }
    this.state = {
      service,
      item,
      song,
      songStatus,
      arrangement: effectiveArrangement(item, song?.history.snapshot.song),
      position: this.position,
      overlay:
        item?.overlays?.some(row => row.id === this.overlay) === true
          ? this.overlay
          : null,
      busy: this.edits.busy,
    };
    for (const listener of this.listeners) listener();
  }
}
