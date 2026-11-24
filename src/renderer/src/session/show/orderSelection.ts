import type {ItemId} from '@core/presentation';
import {useShow, type ShowView} from './showStore';

/** The 예배 순서 row opened last, in the service it was opened in. */
let lastOrderRow: {readonly serviceEpoch: number; readonly id: ItemId} | null =
  null;

function isOrderRow(view: ShowView, id: ItemId | null): id is ItemId {
  return id !== null && view.rows.some(row => row.id === id);
}

// NOTE(0913vision): A library song or a passage opened by itself takes the
// open item's place, but the operator still sees the 예배 순서 row they chose
// last as where new items go.
useShow.subscribe(view => {
  if (isOrderRow(view, view.openItemId)) {
    lastOrderRow = {serviceEpoch: view.serviceEpoch, id: view.openItemId};
  }
});

/**
 * The 예배 순서 row that new items go after: the open item when it is a row
 * of the order; while a library song or a passage is open instead, the row
 * opened last in this service. Null when nothing is open, so new items go to
 * the end.
 */
export function orderSelectionId(): ItemId | null {
  const view = useShow.getState();
  if (view.openItemId === null) return null;
  if (isOrderRow(view, view.openItemId)) return view.openItemId;
  if (
    lastOrderRow?.serviceEpoch === view.serviceEpoch &&
    isOrderRow(view, lastOrderRow.id)
  ) {
    return lastOrderRow.id;
  }
  return null;
}
