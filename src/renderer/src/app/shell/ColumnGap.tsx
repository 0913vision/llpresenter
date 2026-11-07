import type {JSX} from 'react';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import type {DragSession} from './ColumnLayout';
import type {DraggableColumn} from './columns';

/** What a gap needs from the column layout to start a drag. */
export interface ColumnDrag {
  begin(column: DraggableColumn): DragSession | undefined;
}

/** The gap between two columns. Dragging it resizes the column beside it. */
export function ColumnGap({
  column,
  drag,
}: {
  readonly column: DraggableColumn;
  readonly drag: ColumnDrag;
}): JSX.Element {
  return (
    <ResizeGap axis="column" name={column} begin={() => drag.begin(column)} />
  );
}
