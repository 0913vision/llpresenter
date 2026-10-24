import {dragColumn, fitToWindow, type DraggableColumn} from './columns';
import type {ColumnWidthStore} from './columnWidthStore';
import {defaultColumns, type ColumnWidths, type SizeClass} from './sizeClass';

interface Drag {
  readonly column: DraggableColumn;
  readonly start: ColumnWidths;
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

  beginDrag(column: DraggableColumn): void {
    this.drag = {column, start: this.shown};
  }

  dragBy(delta: number): void {
    if (!this.drag) return;
    const {column, start} = this.drag;
    this.display(
      dragColumn({
        column,
        start,
        delta,
        windowWidth: this.options.windowWidth(),
      }),
    );
  }

  /** Saves the width of the dragged column and keeps the other saved width. */
  endDrag(): void {
    if (!this.drag) return;
    const {column} = this.drag;
    this.drag = null;
    this.saved = {...this.saved, [column]: this.shown[column]};
    this.options.store.save(this.sizeClass, this.saved);
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
