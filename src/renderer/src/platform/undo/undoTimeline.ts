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

export interface UndoTimelineState {
  readonly undo: number;
  readonly redo: number;
  readonly busy: boolean;
}

const LIMIT = 200;

/**
 * The order of every undoable step in this window. Each history keeps its own
 * steps; this keeps which one came last, so 실행 취소 runs back the latest step
 * wherever it was made, as PowerPoint does.
 */
class UndoTimeline {
  private undo: UndoOwner[] = [];
  private redo: UndoOwner[] = [];
  private blockedBy: string | undefined;
  private state: UndoTimelineState = {undo: 0, redo: 0, busy: false};
  private readonly listeners = new Set<() => void>();
  private readonly placeListeners = new Set<(place: UndoPlace) => void>();

  readonly get = (): UndoTimelineState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A new step of an owner: it comes last, and nothing can be redone. */
  record(owner: UndoOwner): void {
    this.undo = [...this.undo, owner].slice(-LIMIT);
    this.redo = [];
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
    this.undo = this.undo.filter(entry => entry !== owner);
    this.redo = this.redo.filter(entry => entry !== owner);
    this.publish(this.state.busy);
  }

  /** Runs back, or forward again, the latest step of any history. */
  async replay(
    kind: 'undo' | 'redo',
    report: (notice: Notice) => void,
  ): Promise<boolean> {
    const owner = (kind === 'undo' ? this.undo : this.redo).at(-1);
    if (
      this.blockedBy !== undefined ||
      this.state.busy ||
      owner === undefined
    ) {
      return false;
    }
    if (kind === 'undo') this.undo = this.undo.slice(0, -1);
    else this.redo = this.redo.slice(0, -1);
    this.publish(true);
    let done = false;
    try {
      done = await owner.replay(kind, report);
    } finally {
      if (done && kind === 'undo') this.redo = [...this.redo, owner];
      if (done && kind === 'redo') this.undo = [...this.undo, owner];
      this.publish(false);
    }
    const place = done ? owner.place?.() : undefined;
    if (place !== undefined) {
      for (const listener of this.placeListeners) listener(place);
    }
    return done;
  }

  private publish(busy: boolean): void {
    this.state = {undo: this.undo.length, redo: this.redo.length, busy};
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
