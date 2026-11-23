import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import {isUnchangedSelectionMove} from '@core/common/selectionOrder';

const LABEL_DRAG = 'application/x-llp-label';

/** Before row `index`, or after it when the pointer is in its lower half. */
function dropPosition(event: DragEvent<HTMLElement>, index: number): number {
  const bounds = event.currentTarget.getBoundingClientRect();
  return index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
}

/**
 * Moving 이름표 rows: by their grip, dragged or with Alt+Up and Alt+Down.
 * `names` reads the stored order at the moment of the drop; `move` puts a
 * label at its new index.
 */
export function useLabelReorder({
  shown,
  locked,
  names,
  move,
}: {
  /** The names in the order the rows show. */
  readonly shown: readonly string[];
  readonly locked: boolean;
  readonly names: () => readonly string[];
  readonly move: (name: string, target: number) => void;
}) {
  const dragging = useRef<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  useEffect(
    () => () => {
      // NOTE(0913vision): Removing the dragged element can prevent dragend.
      if (dragging.current !== null) window.dispatchEvent(new Event('dragend'));
    },
    [],
  );
  const stop = (): void => {
    dragging.current = null;
    setDropIndex(null);
  };
  return {
    /** Where the line shows on row `index`: before it, or after the last row. */
    dropAt: (index: number): 'before' | 'after' | undefined =>
      dropIndex === index
        ? 'before'
        : index === shown.length - 1 && dropIndex === shown.length
          ? 'after'
          : undefined,
    /** The drop handlers of row `index`. */
    row: (index: number) => ({
      onDragOver: (event: DragEvent<HTMLDivElement>): void => {
        if (
          locked ||
          dragging.current === null ||
          !event.dataTransfer.types.includes(LABEL_DRAG)
        ) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const position = dropPosition(event, index);
        setDropIndex(
          isUnchangedSelectionMove(shown, new Set([dragging.current]), position)
            ? null
            : position,
        );
      },
      onDragLeave: (event: DragEvent<HTMLDivElement>): void => {
        if (!(
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )) {
          setDropIndex(null);
        }
      },
      onDrop: (event: DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        const name = dragging.current;
        stop();
        if (
          locked ||
          name === null ||
          event.dataTransfer.getData(LABEL_DRAG) !== name
        ) {
          return;
        }
        const stored = names();
        const source = stored.indexOf(name);
        const insertion = dropPosition(event, index);
        if (isUnchangedSelectionMove(stored, new Set([name]), insertion)) {
          return;
        }
        move(name, insertion - (source < insertion ? 1 : 0));
      },
    }),
    /** The handlers of the grip of label `name` on row `index`. */
    grip: (name: string, index: number) => ({
      draggable: !locked,
      onDragStart: (event: DragEvent<HTMLButtonElement>): void => {
        // NOTE(0913vision): Portaled events reach the slide surface drag handler.
        event.stopPropagation();
        if (locked) {
          event.preventDefault();
          return;
        }
        dragging.current = name;
        event.dataTransfer.setData(LABEL_DRAG, name);
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: stop,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (
          locked ||
          !event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !['ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        move(name, index + (event.key === 'ArrowUp' ? -1 : 1));
      },
    }),
  };
}
