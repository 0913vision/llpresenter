import {dragColumn, fitToWindow, type DraggableColumn} from './columns';
import type {ColumnWidthStore} from './columnWidthStore';
import {defaultColumns, type ColumnWidths, type SizeClass} from './sizeClass';

interface Drag {
  readonly column: DraggableColumn;
  readonly start: ColumnWidths;
}

/** One drag of a column gap. */
export interface DragSession {
  move(delta: number): void;
  end(): void;
}

export interface ColumnLayoutOptions {
  readonly store: ColumnWidthStore;
  readonly sizeClass: SizeClass;
  readonly windowWidth: () => number;
  /** Receives the widths to show. It must not do heavy work. */
  readonly show: (widths: ColumnWidths) => void;
}

/**
 * Owns the column widths of the shell: the saved widths of the current size
 * class, the widths on screen, and the drag in progress. It touches no DOM.
 */
export class ColumnLayout {
  private sizeClass: SizeClass;
  private saved: ColumnWidths;
  private shown: ColumnWidths;
  private drag: Drag | null = null;

  constructor(private readonly options: ColumnLayoutOptions) {
    this.sizeClass = options.sizeClass;
    this.saved = this.loadSaved();
    this.shown = this.saved;
    this.refit();
  }

  /** Switches to the saved widths of another size class, or its defaults. */
  setSizeClass(sizeClass: SizeClass): void {
    if (sizeClass === this.sizeClass) return;
    this.drag = null;
    this.sizeClass = sizeClass;
    this.saved = this.loadSaved();
    this.refit();
  }

  /** Shows the saved widths again for the current window width. */
  refit(): void {
    if (this.drag) return;
    this.display(fitToWindow(this.saved, this.options.windowWidth()));
  }

  /**
   * Starts a drag, or returns nothing while another drag is in progress. The
   * session stops working once its drag has ended or has been dropped.
   */
  beginDrag(column: DraggableColumn): DragSession | undefined {
    if (this.drag) return undefined;
    const drag: Drag = {column, start: this.shown};
    this.drag = drag;
    return {
      move: delta => this.dragBy(drag, delta),
      end: () => this.endDrag(drag),
    };
  }

  private dragBy(drag: Drag, delta: number): void {
    if (this.drag !== drag) return;
    this.display(
      dragColumn({
        column: drag.column,
        start: drag.start,
        delta,
        windowWidth: this.options.windowWidth(),
      }),
    );
  }

  /**
   * Saves the dragged column only if its width changed, keeps the other saved
   * width, and fits the widths to a window that resized during the drag.
   */
  private endDrag(drag: Drag): void {
    if (this.drag !== drag) return;
    this.drag = null;
    const {column} = drag;
    if (this.shown[column] !== drag.start[column]) {
      this.saved = {...this.saved, [column]: this.shown[column]};
      this.options.store.save(this.sizeClass, this.saved);
    }
    this.refit();
  }

  private loadSaved(): ColumnWidths {
    return (
      this.options.store.load(this.sizeClass) ?? defaultColumns[this.sizeClass]
    );
  }

  private display(widths: ColumnWidths): void {
    this.shown = widths;
    this.options.show(widths);
  }
}
