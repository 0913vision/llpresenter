import type {Notice} from '@renderer/ui/popups/notices';
import {undoFailure, undoTimeline, type UndoOwner} from './undoTimeline';

/**
 * One rename that 실행 취소 can run back: the names before and after, and how
 * to give the renamed 예배, 템플릿 or playlist a name again.
 */
export interface RenameStep {
  readonly before: string;
  readonly after: string;
  /** Gives the name without recording a new step; false when it was refused. */
  readonly rename: (name: string) => Promise<boolean>;
}

/**
 * The renames of 예배, 템플릿 and playlists in this window, as one history of
 * its 실행 취소 (user decision, November 24).
 */
class RenameHistory implements UndoOwner {
  private undo: RenameStep[] = [];
  private redo: RenameStep[] = [];

  /** A rename that went through; an unchanged name is no step. */
  record(step: RenameStep): void {
    if (step.before === step.after) return;
    this.undo.push(step);
    this.redo = [];
    undoTimeline.record(this);
  }

  readonly replay = async (
    kind: 'undo' | 'redo',
    report: (notice: Notice) => void,
  ): Promise<boolean> => {
    const from = kind === 'undo' ? this.undo : this.redo;
    const step = from.at(-1);
    if (step === undefined) return false;
    const done = await step.rename(kind === 'undo' ? step.before : step.after);
    if (!done) {
      report(undoFailure(kind, '이름 바꾸기'));
      return false;
    }
    from.pop();
    (kind === 'undo' ? this.redo : this.undo).push(step);
    return true;
  };

  /** Forgets every step, as a closed window does. */
  forget(): void {
    this.undo = [];
    this.redo = [];
    undoTimeline.forget(this);
  }
}

/** The renames of this window that 실행 취소 runs back. */
export const renameHistory = new RenameHistory();
