import {useLayoutEffect, useRef, type RefObject} from 'react';
import type {ServiceRow} from '@core/presentation/model';

interface ArmedFocus {
  readonly id: string;
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  /** What had focus when the move started. */
  readonly held: Element | null;
}

function stillOwnsFocus(armed: ArmedFocus): boolean {
  const now = document.activeElement;
  if (now === armed.held) return true;
  return (
    armed.held !== null &&
    !armed.held.isConnected &&
    (now === null || now === document.body)
  );
}

/**
 * Gives focus back to a row that a key moved. A row that crosses a section is
 * mounted anew and loses focus, so the list focuses it again when its rows
 * change. It does so only while the move still owns focus: not after the
 * operator went to another field, not after the move failed (`disarm`), and
 * not after the 예배 순서 changed.
 */
export function useMovedRowFocus(
  list: RefObject<HTMLElement | null>,
  rows: readonly ServiceRow[],
  serviceId: string | null,
) {
  const armed = useRef<ArmedFocus | null>(null);
  useLayoutEffect(() => {
    if (armed.current?.serviceId !== serviceId) armed.current = null;
  }, [serviceId]);
  useLayoutEffect(() => {
    const pending = armed.current;
    if (pending === null || pending.rows === rows) return;
    armed.current = null;
    if (!stillOwnsFocus(pending)) return;
    const row = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-order-id]') ?? []),
    ].find(element => element.dataset['orderId'] === pending.id);
    const option = row?.querySelector<HTMLElement>('[role="option"]');
    if (!option) return;
    // NOTE(0913vision): The list box gives a new row its tab stop in a
    // microtask, so a row that was just mounted has none yet.
    if (!option.hasAttribute('tabindex')) option.tabIndex = -1;
    option.focus();
  }, [list, rows]);
  return {
    /** Starts waiting for the rows of a move; the answer cancels the wait. */
    arm: (id: string): (() => void) => {
      const token: ArmedFocus = {
        id,
        rows,
        serviceId,
        held: document.activeElement,
      };
      armed.current = token;
      return () => {
        if (armed.current === token) armed.current = null;
      };
    },
  };
}
