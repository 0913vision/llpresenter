import type {Result} from '../common/result';
import {SLIDE_CLIPBOARD_LIMITS} from '../schema/slideClipboard';
import {
  copySlideList,
  slidesFromPlainText,
  type SlideClipboard,
  type SlideListAdapter,
  type SlideListCommand,
  type SlideListError,
  type SlideListItem,
  type SlideListSnapshot,
} from './slideListEdits';
import {
  applySlideListCommand,
  createSlideListHistory,
  recordSlideListSnapshot,
  redoSlideList,
  undoSlideList,
  type SlideListHistory,
} from './slideListHistory';
import {selectSlideList, type SlideSelectionAction} from './slideListSelection';

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

export interface SlideListModelOptions<
  T extends SlideListItem,
  Context = unknown,
> {
  readonly slides: readonly T[];
  readonly adapter: SlideListAdapter<T>;
  readonly clipboard: SlideListClipboard<T>;
  readonly context?: Context;
}
export interface SlideListView<
  T extends SlideListItem,
  Context = unknown,
> extends SlideListSnapshot<T, Context> {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** One document's edit session. No DOM, system clipboard, keyboard, or persistence side effects. */
export class SlideListModel<T extends SlideListItem, Context = unknown> {
  private history: SlideListHistory<T, Context>;
  private view: SlideListView<T, Context>;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly options: SlideListModelOptions<T, Context>) {
    const result = createSlideListHistory(
      options.slides,
      options.adapter,
      options.context,
    );
    if (!result.ok) {
      throw new Error(`Invalid initial slide list: ${result.error}`);
    }
    this.history = result.value;
    this.view = this.makeView();
  }

  readonly getSnapshot = (): SlideListView<T, Context> => this.view;
  get limits(): Pick<SlideListAdapter<T>, 'minSlides' | 'maxSlides'> {
    return this.options.adapter;
  }
  /** The immutable content identity is restored by undo independently of availability flags. */
  readonly getContent = (): SlideListSnapshot<T, Context> =>
    this.history.present;
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
      const {textSelection: removed, ...rest} = present;
      this.replace({...this.history, present: {...rest, selection}});
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

  /** Text caret changes do not add undo steps or change a slide selection. */
  readonly selectText = (id: T['id'], start: number, end: number): void => {
    const present = this.history.present;
    const textSelection = {id, start, end};
    if (
      present.textSelection?.id === id &&
      present.textSelection.start === start &&
      present.textSelection.end === end
    ) {
      return;
    }
    this.replace({...this.history, present: {...present, textSelection}});
  };

  readonly edit = (
    snapshot: SlideListSnapshot<T, Context>,
    coalesce = false,
  ): CommandResult => {
    const result = recordSlideListSnapshot(this.history, snapshot, {
      adapter: this.options.adapter,
      coalesce,
    });
    return result.ok ? {ok: true, value: this.replace(result.value)} : result;
  };

  /** An accepted catalog rename also changes undo/redo without adding a step. */
  readonly renameLabel = (from: string, to: string): void => {
    const rename = (
      snapshot: SlideListSnapshot<T, Context>,
    ): SlideListSnapshot<T, Context> => ({
      ...snapshot,
      slides: snapshot.slides.map(slide =>
        slide.label === from ? {...slide, label: to} : slide,
      ),
    });
    this.replace({
      present: rename(this.history.present),
      past: this.history.past.map(rename),
      future: this.history.future.map(rename),
    });
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
    const copied = this.options.clipboard.read();
    if (
      copied !== null &&
      typeof text === 'string' &&
      copied.text.replace(/\r\n?/g, '\n') === text.replace(/\r\n?/g, '\n')
    ) {
      return this.paste();
    }
    const result = slidesFromPlainText(text, this.options.adapter);
    return result.ok
      ? this.command({type: 'paste', slides: result.value})
      : result;
  };

  readonly undo = (): boolean => this.replace(undoSlideList(this.history));
  readonly redo = (): boolean => this.replace(redoSlideList(this.history));

  /** Use for another document or an externally accepted revision; clears selection and history. */
  readonly reset = (slides: readonly T[], context?: Context): CommandResult => {
    const result = createSlideListHistory(
      slides,
      this.options.adapter,
      context,
    );
    return result.ok ? {ok: true, value: this.replace(result.value)} : result;
  };

  private replace(history: SlideListHistory<T, Context>): boolean {
    if (history === this.history) return false;
    this.history = history;
    this.view = this.makeView();
    for (const listener of this.listeners) listener();
    return true;
  }

  private makeView(): SlideListView<T, Context> {
    return {
      ...this.history.present,
      canUndo: this.history.past.length > 0,
      canRedo: this.history.future.length > 0,
    };
  }
}
