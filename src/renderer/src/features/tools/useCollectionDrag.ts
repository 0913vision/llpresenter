import {useRef, useState, type DragEvent} from 'react';
import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
import type {MacroCollection} from '@core/schema/macros';
import type {CollectionRowDrag} from './MacroCollectionRow';

const DRAG_MIME = 'application/x-llpresenter-macro-collection';

type CollectionId = MacroCollection['id'];

/**
 * Moving a 모음 in the 매크로 모음 list by dragging it: the insert line shows
 * where it lands, and a drop that would leave it in place moves nothing.
 * `insertBefore` is the 모음 the line is above, null at the end, and
 * undefined while no line shows.
 */
export function useCollectionDrag({
  collections,
  locked,
  move,
}: {
  readonly collections: readonly MacroCollection[];
  readonly locked: boolean;
  readonly move: (id: CollectionId, before: CollectionId | undefined) => void;
}) {
  const dragging = useRef<CollectionId | null>(null);
  const [insertBefore, setInsertBefore] = useState<
    CollectionId | null | undefined
  >();
  const unchanged = (before: CollectionId | undefined): boolean => {
    if (dragging.current === null) return false;
    const index =
      before === undefined
        ? collections.length
        : collections.findIndex(item => item.id === before);
    return (
      index >= 0 &&
      isUnchangedSelectionMove(
        collections.map(item => item.id),
        new Set([dragging.current]),
        index,
      )
    );
  };
  const drop = (event: DragEvent, before: CollectionId | undefined): void => {
    const id = dragging.current;
    if (locked || id === null) return;
    event.preventDefault();
    event.stopPropagation();
    const noChange = unchanged(before);
    dragging.current = null;
    setInsertBefore(undefined);
    if (!noChange) move(id, before);
  };
  return {
    insertBefore,
    /** The drop handlers of the list, for a drop past the last row. */
    list: {
      onDragOver: (event: DragEvent<HTMLElement>): void => {
        event.stopPropagation();
        if (!locked && dragging.current !== null) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setInsertBefore(unchanged(undefined) ? undefined : null);
        }
      },
      onDragLeave: (event: DragEvent<HTMLElement>): void => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setInsertBefore(undefined);
        }
      },
      onDrop: (event: DragEvent<HTMLElement>): void => {
        event.stopPropagation();
        drop(event, undefined);
      },
    },
    /** The drag of the row of `item`; 모든 매크로 has none and drops before the first. */
    row: (
      item: MacroCollection | undefined,
      renaming: boolean,
    ): CollectionRowDrag => {
      const before = item?.id ?? collections[0]?.id;
      return {
        draggable: item !== undefined && !locked && !renaming,
        onDragStart: event => {
          if (item === undefined || locked) return;
          dragging.current = item.id;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(DRAG_MIME, item.id);
        },
        onDragEnd: () => {
          dragging.current = null;
          setInsertBefore(undefined);
        },
        onDragOver: event => {
          if (locked || dragging.current === null) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          setInsertBefore(unchanged(before) ? undefined : (before ?? null));
        },
        onDrop: event => drop(event, before),
      };
    },
  };
}
