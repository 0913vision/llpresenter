import {useEffect, type RefObject} from 'react';
import type {ServiceRow} from '@core/presentation';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {useReflow} from '@renderer/ui/panels/useReflow';
import type {Workspace} from '@renderer/ui/lists/workspace';
import {useOrderFollow} from './useOrderFollow';
import {useOrderResizeFocus} from './useOrderResizeFocus';
import {useOrderTop} from './useOrderTop';
import {usePrepOrderPosition} from './usePrepOrderPosition';

/** Moves the keyboard focus to the open item when it changes. */
function useOpenItemFocus(
  list: RefObject<HTMLDivElement | null>,
  openItemId: string | null,
): void {
  useEffect(() => {
    const element = list.current;
    if (!element?.contains(document.activeElement)) return;
    // NOTE(0913vision): A cell that edits as text keeps its focus when the
    // click that opened it selects the row.
    if (isInTextEntry(document.activeElement)) return;
    element
      .querySelector<HTMLElement>('[tabindex="0"]')
      ?.focus({preventScroll: true});
  }, [list, openItemId]);
}

/**
 * Keeps the right row of the 예배 순서 in view and focused: the top after a
 * service opens, the live item in 진행, the open item in 준비, and the rows in
 * place while they reflow.
 */
export function useOrderScroll(
  list: RefObject<HTMLDivElement | null>,
  {
    rows,
    serviceId,
    workspace,
    liveItemId,
    openItemId,
  }: {
    readonly rows: readonly ServiceRow[];
    readonly serviceId: string | null;
    readonly workspace: Workspace;
    readonly liveItemId: string | null;
    readonly openItemId: string | null;
  },
): void {
  useReflow(list, {
    ids: rows.map(row => row.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: serviceId,
  });
  useOrderTop(list, serviceId);
  useOrderFollow(list, {
    target: rows.some(row => row.id === liveItemId) ? liveItemId : openItemId,
    liveItemId,
    enabled: workspace === 'show',
  });
  usePrepOrderPosition(list, {
    target: openItemId,
    enabled: workspace === 'prep',
    rows,
  });
  useOrderResizeFocus(list);
  useOpenItemFocus(list, openItemId);
}
