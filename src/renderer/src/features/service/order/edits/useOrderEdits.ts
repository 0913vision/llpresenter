import {liveItemReason} from '@renderer/session/service/liveGuard';
import {useRef, type RefObject} from 'react';
import {orderedSelection} from '@core/common/selectionOrder';
import {createServiceItemId} from '@core/schema/common/ids';
import type {ServiceRow} from '@core/presentation';
import type {OpenServiceResult} from '@renderer/session/service/openService';
import {
  duplicateItems as duplicateOrderItems,
  moveItemsStep,
  removeItems,
} from '@renderer/session/service/serviceOrderEdits';
import type {useServiceOrderEditing} from '@renderer/session/service/useServiceOrderEditing';
import {deleteSelection} from '@renderer/ui/lists/selection/deleteSelection';
import type {ListWorkspace} from '@renderer/ui/lists/workspace';
import {canMoveItems, movableItems} from '../orderRows';
import {useMovedRowFocus} from './useMovedRowFocus';
import {rowAfterDeletion, useOrderEditFocus} from './useOrderEditFocus';
import {useShow} from '@renderer/session/show/showStore';

/** The rows chosen in the list and the way to choose others. */
export interface ChosenRows {
  readonly selected: ReadonlySet<string>;
  readonly replace: (ids: readonly string[], cursor: string) => void;
}

/**
 * The edits of the chosen 예배 순서 rows: move, delete, duplicate, and the
 * history steps, each keeping the focus in the list where the operator was.
 */
export function useOrderEdits({
  list,
  rows,
  serviceId,
  cursor,
  workspace,
  editable,
  editing,
  selection,
}: {
  readonly list: RefObject<HTMLElement | null>;
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  /** The open item. */
  readonly cursor: string | null;
  readonly workspace: ListWorkspace;
  readonly editable: boolean;
  readonly editing: ReturnType<typeof useServiceOrderEditing>;
  readonly selection: ChosenRows;
}) {
  const editFocus = useOrderEditFocus({list, rows, serviceId, cursor});
  const movedFocus = useMovedRowFocus(list, rows, serviceId);

  /** The row alone when it is not chosen, otherwise every chosen row. */
  const targets = (id?: string): readonly string[] =>
    rows
      .filter(row =>
        id !== undefined && !selection.selected.has(id)
          ? row.id === id
          : selection.selected.has(row.id),
      )
      .map(row => row.id);

  const moveItems = (
    ids: readonly string[],
    direction: 'up' | 'down',
    focusId: string,
  ): void => {
    const movable = movableItems(rows, ids);
    if (!editable || movable.length === 0) return;
    if (!canMoveItems(rows, movable, direction)) return;
    const disarm = movedFocus.arm(focusId);
    editing
      .save(() => moveItemsStep(movable.map(createServiceItemId), direction))
      .then(
        saved => {
          if (!saved) disarm();
        },
        (error: unknown) => {
          disarm();
          console.error('Could not move a 예배 순서 item:', error);
        },
      );
  };

  /** Runs an edit that may take rows away, then puts the focus back. */
  const runFocusedEdit = (
    operation: () => Promise<OpenServiceResult>,
    deleted?: readonly string[],
  ): void => {
    const disarm = editFocus.arm(
      workspace === 'prep' ? deleted : undefined,
      workspace === 'prep' && deleted
        ? id => selection.replace([id], id)
        : undefined,
    );
    editing.run(async () => {
      try {
        const result = await operation();
        if (
          result.ok ? !result.value : result.error.reason !== 'write-failed'
        ) {
          disarm();
        }
        return result;
      } catch (error) {
        disarm();
        throw error;
      }
    });
  };

  // NOTE(0913vision): The rows follow main, so they show a deleted row until
  // main has it. A Delete pressed before then must take the next row, not
  // the one on its way out, so the choice moves on at once.
  const deleting = useRef(new Set<string>());

  const remove = (ids: readonly string[]): void => {
    const chosen = ids.filter(id => !deleting.current.has(id));
    if (
      !editable ||
      chosen.length === 0 ||
      liveItemReason(chosen) !== undefined
    ) {
      return;
    }
    const snapshot = useShow.getState();
    deleteSelection(
      chosen.length,
      () =>
        useShow.getState().serviceId === snapshot.serviceId &&
        useShow.getState().rows === snapshot.rows &&
        !useShow.getState().readOnly,
      () => {
        const shown = rows.filter(row => !deleting.current.has(row.id));
        const next = rowAfterDeletion(
          shown,
          chosen,
          shown.filter(row => !chosen.includes(row.id)),
        );
        for (const id of chosen) deleting.current.add(id);
        if (workspace === 'prep' && next !== undefined) {
          selection.replace([next], next);
        }
        runFocusedEdit(
          () =>
            removeItems(chosen.map(createServiceItemId)).finally(() => {
              for (const id of chosen) deleting.current.delete(id);
            }),
          [...deleting.current],
        );
      },
    );
  };

  const duplicate = (ids: readonly string[]): void => {
    if (!editable || ids.length === 0) return;
    const copies = new Map(
      orderedSelection(rows, new Set(ids), row => row.kind === 'header').map(
        row => [
          createServiceItemId(row.id),
          createServiceItemId(crypto.randomUUID()),
        ],
      ),
    );
    const copyIds = [...copies.values()];
    editing
      .save(() => duplicateOrderItems(copies))
      .then(saved => {
        const last = copyIds.at(-1);
        if (saved && last !== undefined) selection.replace(copyIds, last);
      })
      .catch((cause: unknown) =>
        console.error('Could not duplicate service items:', cause),
      );
  };

  return {targets, moveItems, runFocusedEdit, remove, duplicate};
}
