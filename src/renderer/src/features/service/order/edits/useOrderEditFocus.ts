import {useLayoutEffect, useRef, type RefObject} from 'react';
import type {ServiceRow} from '@core/presentation';

/** What an edit of the list remembers until the list shows its result. */
interface PendingFocus {
  /** What had the focus when the edit was sent. */
  readonly held: Element | null;
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  readonly deleted: readonly string[] | undefined;
  readonly select: ((id: string) => void) | undefined;
}

/**
 * Whether the operator put the focus somewhere else while the edit was on its
 * way, so the list must not take it back. What held it still holds it, or
 * still exists, or the focus is in another place than the list's deleted rows.
 */
function focusMovedOn(
  token: PendingFocus,
  active: Element | null,
  list: HTMLElement | null,
): boolean {
  if (active === token.held) return false;
  if (token.held?.isConnected === true) return true;
  return (
    active !== document.body &&
    active !== null &&
    !(token.deleted !== undefined && list?.contains(active) === true)
  );
}

/**
 * The row the cursor goes to after rows were deleted: the first one left
 * after them, or else the last one left before them.
 */
export function rowAfterDeletion(
  before: ReadonlyArray<{readonly id: string}>,
  deleted: readonly string[],
  after: ReadonlyArray<{readonly id: string}>,
): string | undefined {
  const index = before.findIndex(row => deleted.includes(row.id));
  if (index < 0) return undefined;
  const left = new Set(after.map(row => row.id));
  return (
    before.slice(index).find(row => left.has(row.id))?.id ??
    before
      .slice(0, index)
      .reverse()
      .find(row => left.has(row.id))?.id
  );
}

/** Keeps a history/delete command in the list without stealing later focus. */
export function useOrderEditFocus({
  list,
  rows,
  serviceId,
  cursor,
}: {
  readonly list: RefObject<HTMLElement | null>;
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  readonly cursor: string | null;
}) {
  const pending = useRef<PendingFocus | null>(null);
  useLayoutEffect(() => {
    const token = pending.current;
    if (token === null) return;
    if (token.serviceId !== serviceId) {
      pending.current = null;
      return;
    }
    if (token.rows === rows) return;
    pending.current = null;
    if (focusMovedOn(token, document.activeElement, list.current)) return;
    // NOTE(0913vision): An unchanged cell already owns the next command.
    if (
      !token.deleted &&
      token.held?.isConnected &&
      token.held.closest('[role="option"]')
    ) {
      return;
    }
    const box = list.current?.querySelector<HTMLElement>('[role="listbox"]');
    const options = [
      ...(box?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ];
    const nextId =
      token.deleted === undefined
        ? undefined
        : rowAfterDeletion(token.rows, token.deleted, rows);
    if (nextId !== undefined) token.select?.(nextId);
    const target =
      options.find(option => option.dataset['value'] === (nextId ?? cursor)) ??
      options[0] ??
      box;
    if (target === undefined || target === null) return;
    // NOTE(0913vision): New options get their tab stop in a later microtask.
    // An empty list needs a named focus target that can still receive Undo.
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({preventScroll: true});
  }, [list, rows, serviceId, cursor]);
  return {
    arm: (
      deleted?: readonly string[],
      select?: (id: string) => void,
    ): (() => void) => {
      const token = {
        held: document.activeElement,
        rows,
        serviceId,
        deleted,
        select,
      };
      pending.current = token;
      return () => {
        if (pending.current === token) pending.current = null;
      };
    },
  };
}
