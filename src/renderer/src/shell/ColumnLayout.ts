import {dragColumn, fitToWindow, type DraggableColumn} from './columns';
import type {ColumnWidthStore} from './columnWidthStore';
import {
  defaultColumns,
  type ColumnWidths,
  type SizeClass,
} from '../ui/sizeClass';

// NOTE(0913vision): After a resize fits the widths mid-drag, the pointer
// movement counts from `widthsAtLastFit`. `pointerMoved` stays true when the
// pointer returns to its first place, because the width on screen can still
// differ from `widthsAtStart`, and then the operator did change it.
interface Drag {
  readonly column: DraggableColumn;
  readonly widthsAtStart: ColumnWidths;
  widthsAtLastFit: ColumnWidths;
  movementAtLastFit: number;
  lastMovement: number;
  pointerMoved: boolean;
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
 * Call `refit` once to show the first widths.
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
  }

  /** Switches to the saved widths of another size class, or its defaults. */
  setSizeClass(sizeClass: SizeClass): void {
    if (sizeClass === this.sizeClass) return;
    this.drag = null;
    this.sizeClass = sizeClass;
    this.saved = this.loadSaved();
    this.refit();
  }

  /**
   * Shows the saved widths again for the current window width. During a drag
   * it fits the widths on screen at once, and the drag goes on from there.
   */
  refit(): void {
    const windowWidth = this.options.windowWidth();
    if (this.drag) {
      this.refitDrag(this.drag, windowWidth);
      return;
    }
    this.display(fitToWindow(this.saved, windowWidth));
  }

  /**
   * Starts a drag, or returns nothing while another drag is in progress. The
   * session stops working once its drag has ended or has been dropped.
   */
  beginDrag(column: DraggableColumn): DragSession | undefined {
    if (this.drag) return undefined;
    const drag: Drag = {
      column,
      widthsAtStart: this.shown,
      widthsAtLastFit: this.shown,
      movementAtLastFit: 0,
      lastMovement: 0,
      pointerMoved: false,
    };
    this.drag = drag;
    return {
      move: delta => this.dragBy(drag, delta),
      end: () => this.endDrag(drag),
    };
  }

  private refitDrag(drag: Drag, windowWidth: number): void {
    const fitted = fitToWindow(this.shown, windowWidth);
    if (fitted.left === this.shown.left && fitted.right === this.shown.right) {
      return;
    }
    drag.widthsAtLastFit = fitted;
    drag.movementAtLastFit = drag.lastMovement;
    this.display(fitted);
  }

  private dragBy(drag: Drag, delta: number): void {
    if (this.drag !== drag) return;
    drag.lastMovement = delta;
    if (delta !== 0) drag.pointerMoved = true;
    this.display(
      dragColumn({
        column: drag.column,
        start: drag.widthsAtLastFit,
        delta: delta - drag.movementAtLastFit,
        windowWidth: this.options.windowWidth(),
      }),
    );
  }

  private endDrag(drag: Drag): void {
    if (this.drag !== drag) return;
    this.drag = null;
    const {column} = drag;
    // NOTE(0913vision): Save only a changed width, so that a click on a gap
    // does not store a width that is shrunk on screen only.
    if (
      drag.pointerMoved &&
      this.shown[column] !== drag.widthsAtStart[column]
    ) {
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
