import {useLayoutEffect, useRef, type RefObject} from 'react';
import type {ServiceRow} from '@core/presentation/model';

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
  const pending = useRef<{
    held: Element | null;
    rows: readonly ServiceRow[];
    serviceId: string | null;
  } | null>(null);
  useLayoutEffect(() => {
    const token = pending.current;
    if (token === null) return;
    if (token.serviceId !== serviceId) {
      pending.current = null;
      return;
    }
    if (token.rows === rows) return;
    pending.current = null;
    const active = document.activeElement;
    if (
      active !== token.held &&
      (token.held?.isConnected || (active !== document.body && active !== null))
    ) {
      return;
    }
    // NOTE(0913vision): An unchanged cell already owns the next command.
    if (token.held?.isConnected && token.held.closest('[role="option"]')) {
      return;
    }
    const box = list.current?.querySelector<HTMLElement>('[role="listbox"]');
    const options = [
      ...(box?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
    ];
    const target =
      options.find(option => option.dataset['value'] === cursor) ??
      options[0] ??
      box;
    if (target === undefined || target === null) return;
    // NOTE(0913vision): New options get their tab stop in a later microtask.
    // An empty list needs a named focus target that can still receive Undo.
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }, [list, rows, serviceId, cursor]);
  return {
    arm: (): (() => void) => {
      const token = {held: document.activeElement, rows, serviceId};
      pending.current = token;
      return () => {
        if (pending.current === token) pending.current = null;
      };
    },
  };
}
