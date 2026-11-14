import {SlideListClipboard, SlideListModel} from '@core/songs/slideListModel';
import type {SlideSelectionAction} from '@core/songs/slideListSelection';
import type {ShowTile} from '@core/schema/showService';
import type {SlideListSession} from '@renderer/features/songs/editor/slideListSession';
import type {ServiceItemStore} from './serviceItemStore';
import {editorTask} from '@renderer/features/songs/editor/editorTask';

interface BibleSlide {
  readonly id: string;
  readonly lines: readonly string[];
}

/** Selection-only session for Bible verses; all content mutation commands are refused. */
export class BibleSlideSession implements SlideListSession<BibleSlide> {
  readonly clipboardOwner = {};
  readonly slideIntent = 0;
  readonly slideModel: SlideListModel<BibleSlide>;
  constructor(
    readonly slideDocumentId: string,
    tiles: readonly ShowTile[],
    private readonly options: {
      readonly items: ServiceItemStore;
      readonly offset: number;
      readonly readOnly: boolean;
    },
  ) {
    this.slideModel = new SlideListModel({
      slides: tiles.map((tile, index) => ({
        id: String(index),
        lines: tile.lines,
      })),
      clipboard: new SlideListClipboard(),
      adapter: {
        newId: () => '',
        fromLines: (lines, id) => ({id, lines}),
        toLines: slide => slide.lines,
        validate: slides => ({ok: true, value: slides}),
        minSlides: 0,
        maxSlides: Math.max(tiles.length, 1),
      },
    });
    const savedSelection = options.items.getSnapshot().bibleSelection;
    const selected =
      savedSelection.length > 0
        ? savedSelection
        : options.items.getSnapshot().cardSelected
          ? []
          : [
              Math.max(
                0,
                options.items.getSnapshot().position - options.offset,
              ),
            ];
    for (const index of selected) {
      const slide = this.slideModel.getSnapshot().slides[index];
      if (slide !== undefined) {
        this.slideModel.select({type: 'click', id: slide.id, ctrl: true});
      }
    }
  }
  get readOnly(): boolean {
    return this.options.readOnly;
  }
  get canUndo(): boolean {
    return this.options.items.canUndoItemEdit('undo');
  }
  get canRedo(): boolean {
    return this.options.items.canUndoItemEdit('redo');
  }
  get selectedOccurrence(): number {
    const focus = this.slideModel.getSnapshot().selection.focus;
    return focus?.kind === 'slide' ? Number(focus.id) : 0;
  }
  selectSlides(action: SlideSelectionAction<string>): void {
    this.slideModel.select(action);
    const selection = this.slideModel.getSnapshot().selection;
    this.options.items.setBibleSelection([...selection.ids].map(Number));
    const focus = selection.focus;
    if (focus?.kind === 'slide') {
      this.options.items.selectPosition(Number(focus.id) + this.options.offset);
    }
  }
  commandSlides(): void {
    return;
  }
  copySlides(): string | null {
    const result = this.slideModel.copy();
    return result.ok ? result.value : null;
  }
  cutSlides(): null {
    return null;
  }
  pasteSlides(): void {
    return;
  }
  edit(action: 'undo' | 'redo'): void {
    if (!this.readOnly) editorTask(this.options.items.replayItemEdit(action));
  }
}
