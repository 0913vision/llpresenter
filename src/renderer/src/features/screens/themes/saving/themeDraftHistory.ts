import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';

/** The most steps the theme editor can go back through. */
export const THEME_HISTORY_LIMIT = 100;

/**
 * One step of the theme editor: the working copy before an edit, or a save
 * with the theme list before and after it.
 */
export type ThemeStep =
  | {readonly kind: 'draft'; readonly value: ThemeFile | null}
  | {readonly kind: 'saved'; readonly before: Themes; readonly after: Themes};

/** Which way a step goes: 실행 취소 or 다시 실행. */
export type ThemeStepDirection = 'undo' | 'redo';

/**
 * The steps 실행 취소 and 다시 실행 go through in the theme editor: each edit
 * of the working copy, or each group of edits such as one drag, and each
 * save.
 */
export class ThemeDraftHistory {
  private writing = false;
  private past: ThemeStep[] = [];
  private future: ThemeStep[] = [];
  private group: {changed: boolean} | null = null;

  /**
   * Starts a group of edits that go back as one step, such as one drag.
   *
   * @returns The call that ends the group.
   */
  beginGroup(): () => void {
    const current = {changed: false};
    this.group = current;
    return () => {
      if (this.group === current) this.group = null;
    };
  }

  /**
   * An edit is about to change the working copy: the copy before it becomes a
   * step, once per group, and nothing is left to redo.
   */
  edited(before: ThemeFile | null): void {
    if (this.group?.changed !== true) {
      this.remember({kind: 'draft', value: before});
    }
    if (this.group !== null) this.group.changed = true;
    this.future = [];
  }

  /** Whether a save step is being written; no other step goes until it is done. */
  get busy(): boolean {
    return this.writing;
  }

  /** A save step's write started, or ended. */
  setWriting(writing: boolean): void {
    this.writing = writing;
  }

  /** A save: going back writes the list as it was before it. */
  saved(before: Themes, after: Themes): void {
    this.remember({kind: 'saved', before, after});
  }

  /** The step `direction` takes next. Asking ends any group of edits. */
  next(direction: ThemeStepDirection): ThemeStep | undefined {
    this.group = null;
    return this.side(direction).at(-1);
  }

  /** The next draft step was taken; the copy it replaced goes the other way. */
  tookDraft(direction: ThemeStepDirection, replaced: ThemeFile | null): void {
    this.side(direction).pop();
    this.side(opposite(direction)).push({kind: 'draft', value: replaced});
  }

  /** A save step was written; it goes the other way if it is still next. */
  tookSaved(direction: ThemeStepDirection, step: ThemeStep): void {
    const side = this.side(direction);
    if (side.at(-1) !== step) return;
    side.pop();
    this.side(opposite(direction)).push(step);
  }

  /** Whether a step can go that way now. */
  can(direction: ThemeStepDirection): boolean {
    return !this.writing && this.side(direction).length > 0;
  }

  /** Drops every step, as when the working copy is saved or thrown away. */
  forget(): void {
    this.group = null;
    this.past = [];
    this.future = [];
  }

  private remember(step: ThemeStep): void {
    this.past = [...this.past, step].slice(-THEME_HISTORY_LIMIT);
    this.future = [];
  }

  private side(direction: ThemeStepDirection): ThemeStep[] {
    return direction === 'undo' ? this.past : this.future;
  }
}

function opposite(direction: ThemeStepDirection): ThemeStepDirection {
  return direction === 'undo' ? 'redo' : 'undo';
}
