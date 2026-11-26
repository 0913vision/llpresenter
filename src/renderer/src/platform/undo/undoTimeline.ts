import {useSyncExternalStore} from 'react';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {NOTHING_TO_REDO, NOTHING_TO_UNDO} from '../problemReasons';

/** Where a step that ran back or forward shows, so the window can bring it up. */
export type UndoPlace =
  | {
      readonly kind: 'service';
      readonly itemId: string;
      readonly slideId?: string | undefined;
    }
  | {readonly kind: 'song'; readonly songId: string}
  | {readonly kind: 'media'; readonly mediaId: string};

/** A history that keeps its own steps: service edits, or deletions of one kind. */
export interface UndoOwner {
  /**
   * Runs this history's latest step back, or forward again; false when it
   * could not, after telling `report` why if the operator should know.
   */
  readonly replay: (
    kind: 'undo' | 'redo',
    report: (notice: Notice) => void,
  ) => Promise<boolean>;
  /** Where its latest step that ran shows, if anywhere. */
  readonly place?: (() => UndoPlace | undefined) | undefined;
}

/**
 * The toolbar tab a step was made in. 실행 취소 runs back only the steps of
 * the tab on screen, each tab with its own history (USER Nov 25: "실행취소는
 * 이제 각 탭별로 별도적용되어야하는거아님?").
 */
export type UndoTab = 'show' | 'prep' | 'library' | 'screens';

/** A step of the timeline: whose it is, and the tab it was made in. */
interface Entry {
  readonly owner: UndoOwner;
  readonly tab: UndoTab;
}

/**
 * How many steps the window can undo and redo, and whether one is running now.
 */
export interface UndoTimelineState {
  readonly undo: number;
  readonly redo: number;
  readonly busy: boolean;
}

const LIMIT = 200;

/**
 * The order of the undoable steps of each tab of this window. Each history
 * keeps its own steps; this keeps which one came last in the tab on screen,
 * so 실행 취소 runs back the latest step made there, as PowerPoint does in one
 * document.
 *
 * A history runs back only its own latest step. Its steps stay in one tab:
 * a step it makes in another tab drops the ones it made before elsewhere,
 * which could no longer run in their order.
 */
class UndoTimeline {
  private undo: Entry[] = [];
  private redo: Entry[] = [];
  private tab: UndoTab = 'prep';
  private blockedBy: string | undefined;
  private state: UndoTimelineState = {undo: 0, redo: 0, busy: false};
  private readonly listeners = new Set<() => void>();
  private readonly placeListeners = new Set<(place: UndoPlace) => void>();

  readonly get = (): UndoTimelineState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The tab on screen, whose steps 실행 취소 and 다시 실행 run. */
  showTab(tab: UndoTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.publish(this.state.busy);
  }

  /**
   * A new step of an owner, in the tab on screen unless the owner's steps
   * always belong to one tab: it comes last there, and nothing of that tab or
   * that owner can be redone.
   */
  record(owner: UndoOwner, tab: UndoTab = this.tab): void {
    this.undo = [
      ...this.undo.filter(entry => entry.owner !== owner || entry.tab === tab),
      {owner, tab},
    ].slice(-LIMIT);
    this.redo = this.redo.filter(
      entry => entry.owner !== owner && entry.tab !== tab,
    );
    this.publish(this.state.busy);
  }

  /**
   * Puts back `count` steps of an owner whose history came back, such as a
   * song that 실행 취소 brought back with its edits, last in their tab. What
   * can be redone stays.
   */
  resume(owner: UndoOwner, count: number, tab: UndoTab): void {
    this.undo = [
      ...this.undo.filter(entry => entry.owner !== owner),
      ...Array.from({length: count}, () => ({owner, tab})),
    ].slice(-LIMIT);
    this.publish(this.state.busy);
  }

  /**
   * Takes away the latest step of an owner that the owner ran back on its own,
   * such as from the 되돌리기 of a notice.
   */
  drop(owner: UndoOwner): void {
    const index = this.undo.findLastIndex(entry => entry.owner === owner);
    if (index < 0) return;
    this.undo = [...this.undo.slice(0, index), ...this.undo.slice(index + 1)];
    this.publish(this.state.busy);
  }

  /** Hears where each step that ran shows, to bring it into view. */
  readonly onPlace = (listener: (place: UndoPlace) => void): (() => void) => {
    this.placeListeners.add(listener);
    return () => this.placeListeners.delete(listener);
  };

  /** Why no step may run now, such as 진행 being shown; nothing to allow it again. */
  block(reason: string | undefined): void {
    if (this.blockedBy === reason) return;
    this.blockedBy = reason;
    this.publish(this.state.busy);
  }

  /** Why no step may run now. */
  blocked(): string | undefined {
    return this.blockedBy;
  }

  /** Drops the steps of an owner whose history is gone, such as a closed service. */
  forget(owner: UndoOwner): void {
    this.undo = this.undo.filter(entry => entry.owner !== owner);
    this.redo = this.redo.filter(entry => entry.owner !== owner);
    this.publish(this.state.busy);
  }

  /** Runs back, or forward again, the latest step of the tab on screen. */
  async replay(
    kind: 'undo' | 'redo',
    report: (notice: Notice) => void,
  ): Promise<boolean> {
    const from = kind === 'undo' ? this.undo : this.redo;
    const index = from.findLastIndex(entry => entry.tab === this.tab);
    const entry = from[index];
    if (
      this.blockedBy !== undefined ||
      this.state.busy ||
      entry === undefined
    ) {
      return false;
    }
    const rest = from.filter((_, at) => at !== index);
    if (kind === 'undo') this.undo = rest;
    else this.redo = rest;
    this.publish(true);
    const {owner} = entry;
    let done = false;
    try {
      done = await owner.replay(kind, report);
    } finally {
      if (done && kind === 'undo') this.redo = [...this.redo, entry];
      if (done && kind === 'redo') this.undo = [...this.undo, entry];
      this.publish(false);
    }
    const place = done ? owner.place?.() : undefined;
    if (place !== undefined) {
      for (const listener of this.placeListeners) listener(place);
    }
    return done;
  }

  private publish(busy: boolean): void {
    const here = (entry: Entry): boolean => entry.tab === this.tab;
    this.state = {
      undo: this.undo.filter(here).length,
      redo: this.redo.filter(here).length,
      busy,
    };
    for (const listener of this.listeners) listener();
  }
}

/** The one timeline of this window. */
export const undoTimeline = new UndoTimeline();

/** The timeline's counts, so 실행 취소 and 다시 실행 show whether they can run. */
export function useUndoTimeline(): UndoTimelineState {
  return useSyncExternalStore(undoTimeline.subscribe, undoTimeline.get);
}

/** Why 실행 취소 or 다시 실행 cannot run now; nothing when it can. */
export function undoReason(kind: 'undo' | 'redo'): string | undefined {
  const blocked = undoTimeline.blocked();
  if (blocked !== undefined) return blocked;
  const state = undoTimeline.get();
  if (!state.busy && state[kind] > 0) return undefined;
  return kind === 'undo' ? NOTHING_TO_UNDO : NOTHING_TO_REDO;
}

/** The notice of a step a history could not run back or forward again. */
export function undoFailure(kind: 'undo' | 'redo', what: string): Notice {
  return {
    key: `undo:${what}`,
    kind: 'warning',
    icon: 'warning',
    title: `${what} ${kind === 'undo' ? '실행 취소' : '다시 실행'} 실패`,
    time: noticeTime(),
  };
}

/** For a part without notices: a step that could not run goes to the log. */
export function logUndoProblem(notice: Notice): void {
  console.error('Undo failed:', notice.key);
}
