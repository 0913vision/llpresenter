import type {Result} from '@core/common/result';
import {SLIDE_CLIPBOARD_LIMITS} from '@core/schema/slideClipboard';
import {
  copySlideList,
  slidesFromPlainText,
  type SlideClipboard,
  type SlideListAdapter,
  type SlideListCommand,
  type SlideListError,
  type SlideListItem,
  type SlideListSnapshot,
} from '@core/songs/slideListEdits';
import {
  applySlideListCommand,
  createSlideListHistory,
  redoSlideList,
  undoSlideList,
  type SlideListHistory,
} from '@core/songs/slideListHistory';
import {
  selectSlideList,
  type SlideSelectionAction,
} from '@core/songs/slideListSelection';

type CommandResult = Result<boolean, SlideListError>;

/** Share one bounded clipboard between editor models of the same slide type. */
export class SlideListClipboard<T extends SlideListItem> {
  private value: SlideClipboard<T> | null = null;

  read(): SlideClipboard<T> | null {
    return structuredClone(this.value);
  }

  write(value: SlideClipboard<T>): CommandResult {
    if (
      value.slides.length > SLIDE_CLIPBOARD_LIMITS.slides ||
      value.text.length > SLIDE_CLIPBOARD_LIMITS.characters
    ) {
      return {ok: false, error: 'limit'};
    }
    this.value = structuredClone(value);
    return {ok: true, value: true};
  }

  clear(): void {
    this.value = null;
  }
}

export interface SlideListModelOptions<T extends SlideListItem> {
  readonly slides: readonly T[];
  readonly adapter: SlideListAdapter<T>;
  readonly clipboard: SlideListClipboard<T>;
}
export interface SlideListView<
  T extends SlideListItem,
> extends SlideListSnapshot<T> {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** One document's edit session. No DOM, system clipboard, keyboard, or persistence side effects. */
export class SlideListModel<T extends SlideListItem> {
  private history: SlideListHistory<T>;
  private view: SlideListView<T>;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly options: SlideListModelOptions<T>) {
    const result = createSlideListHistory(options.slides, options.adapter);
    if (!result.ok) {
      throw new Error(`Invalid initial slide list: ${result.error}`);
    }
    this.history = result.value;
    this.view = this.makeView();
  }

  readonly getSnapshot = (): SlideListView<T> => this.view;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly select = (action: SlideSelectionAction<T['id']>): void => {
    const {present} = this.history;
    const selection = selectSlideList(
      present.slides.map(slide => slide.id),
      present.selection,
      action,
    );
    if (selection !== present.selection) {
      this.replace({...this.history, present: {...present, selection}});
    }
  };

  readonly command = (command: SlideListCommand<T>): CommandResult => {
    const result = applySlideListCommand(
      this.history,
      command,
      this.options.adapter,
    );
    return result.ok ? {ok: true, value: this.replace(result.value)} : result;
  };

  /** Returns plain text for the caller's clipboard event, without system clipboard I/O. */
  readonly copy = (): Result<string | null, SlideListError> => {
    const copied = copySlideList(this.history.present, this.options.adapter);
    if (!copied.ok) return copied;
    if (copied.value === null) return {ok: true, value: null};
    const written = this.options.clipboard.write(copied.value);
    return written.ok ? {ok: true, value: copied.value.text} : written;
  };

  /** A refused delete leaves both history and the existing clipboard untouched. */
  readonly cut = (): Result<string | null, SlideListError> => {
    const copied = copySlideList(this.history.present, this.options.adapter);
    if (!copied.ok) return copied;
    if (copied.value === null) return {ok: true, value: null};
    const next = applySlideListCommand(
      this.history,
      {type: 'delete'},
      this.options.adapter,
    );
    if (!next.ok) return next;
    const written = this.options.clipboard.write(copied.value);
    if (!written.ok) return written;
    this.replace(next.value);
    return {ok: true, value: copied.value.text};
  };

  readonly paste = (): CommandResult => {
    const copied = this.options.clipboard.read();
    return copied === null
      ? {ok: true, value: false}
      : this.command({type: 'paste', slides: copied.slides});
  };

  readonly pasteText = (text: unknown): CommandResult => {
    const result = slidesFromPlainText(text, this.options.adapter);
    return result.ok
      ? this.command({type: 'paste', slides: result.value})
      : result;
  };

  readonly undo = (): boolean => this.replace(undoSlideList(this.history));
  readonly redo = (): boolean => this.replace(redoSlideList(this.history));

  /** Use for another document or an externally accepted revision; clears selection and history. */
  readonly reset = (slides: readonly T[]): CommandResult => {
    const result = createSlideListHistory(slides, this.options.adapter);
    return result.ok ? {ok: true, value: this.replace(result.value)} : result;
  };

  private replace(history: SlideListHistory<T>): boolean {
    if (history === this.history) return false;
    this.history = history;
    this.view = this.makeView();
    for (const listener of this.listeners) listener();
    return true;
  }

  private makeView(): SlideListView<T> {
    return {
      ...this.history.present,
      canUndo: this.history.past.length > 0,
      canRedo: this.history.future.length > 0,
    };
  }
}
