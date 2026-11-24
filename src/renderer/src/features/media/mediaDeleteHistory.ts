import {MEDIA_DELETE_HISTORY_LIMIT} from '@core/schema/media/mediaList';

/** Which way a step of the delete history goes. */
export type HistoryStep = 'undo' | 'redo';

/**
 * The 실행 취소 steps of media and playlist deletes in this window. Main keeps
 * the deleted items; this counts the steps and the list revision they were
 * written at, so a later change to the list by someone else ends the redo
 * steps, as an edit ends them anywhere else.
 */
export class MediaDeleteHistory {
  private undoCount = 0;
  private redoCount = 0;
  /** The list revision the steps were last written at; null while there are none. */
  private revision: number | null = null;
  /** True while a delete, an undo or a redo waits for main. */
  private waiting = false;

  /** Whether a delete, an undo or a redo waits for main. */
  get busy(): boolean {
    return this.waiting;
  }

  /** Whether a step can be taken in that direction now. */
  can(step: HistoryStep): boolean {
    return (
      !this.waiting && (step === 'undo' ? this.undoCount : this.redoCount) > 0
    );
  }

  /** Notes that a delete, an undo or a redo was sent to main. */
  begin(): void {
    this.waiting = true;
  }

  /** Notes that main answered. */
  end(): void {
    this.waiting = false;
  }

  /**
   * Adds the delete main wrote at `revision` as an undo step and drops the redo
   * steps. With no revision the list moved on past it, and every step goes.
   *
   * @returns Whether the delete became a step.
   */
  recordDelete(revision: number | null): boolean {
    if (revision === null) {
      this.forget();
      return false;
    }
    this.revision = revision;
    this.undoCount = Math.min(this.undoCount + 1, MEDIA_DELETE_HISTORY_LIMIT);
    this.redoCount = 0;
    return true;
  }

  /**
   * Moves one step from one side to the other after main wrote the undo or
   * redo at `revision`. With no revision every step goes.
   *
   * @returns Whether the steps still apply.
   */
  recordStep(step: HistoryStep, revision: number | null): boolean {
    if (revision === null) {
      this.forget();
      return false;
    }
    this.revision = revision;
    this.undoCount += step === 'undo' ? -1 : 1;
    this.redoCount += step === 'undo' ? 1 : -1;
    return true;
  }

  /** Follows a newer list: a change made elsewhere ends the redo steps. */
  follow(listRevision: number): void {
    if (
      this.waiting ||
      this.revision === null ||
      listRevision <= this.revision
    ) {
      return;
    }
    this.redoCount = 0;
    this.revision = listRevision;
  }

  /** Drops every step. */
  forget(): void {
    this.undoCount = 0;
    this.redoCount = 0;
    this.revision = null;
  }
}
