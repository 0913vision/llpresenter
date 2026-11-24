import type {KeyboardEvent, MouseEvent} from 'react';
import {
  contextMenuAnchor,
  pointerMenuAnchor,
  takeMenuKey,
} from '@renderer/ui/contextMenu';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {isInTextEntry} from '@renderer/ui/textEntry';
import type {Workspace} from '@renderer/ui/workspace';
import {serviceOrderRowId} from './useServiceOrderDrag';
import type {useServiceItemSelection} from './useServiceItemSelection';

/**
 * The pointer and key handling of the whole 예배 순서 list: a click picks
 * rows, a double click or Enter opens a row in 준비, and a right click or
 * the menu key opens the item menu (in 준비 only for the key).
 */
export function useOrderListEvents({
  navigator,
  workspace,
  selection,
  clickCapture,
  openMenu,
  openOrderEditor,
}: {
  /** The list is beside the editor of an item, as in 준비. */
  readonly navigator: boolean;
  readonly workspace: Workspace;
  readonly selection: ReturnType<typeof useServiceItemSelection>;
  /** The drag's own click handling, which may take the click. */
  readonly clickCapture: (event: MouseEvent<HTMLDivElement>) => void;
  readonly openMenu: (
    id: string,
    list: Element,
    anchor: (targets: readonly HTMLElement[]) => MenuAnchor,
  ) => void;
  readonly openOrderEditor: (id: string | null) => boolean;
}) {
  return {
    onMouseDownCapture: (event: MouseEvent<HTMLDivElement>): void => {
      // NOTE(0913vision): Beside the editor, a click on a row keeps the
      // focus in the editor's field instead of taking it to the list.
      if (
        navigator &&
        event.button === 0 &&
        event.target instanceof Element &&
        event.target.closest('[role="option"]') !== null &&
        document.activeElement?.closest('[data-panel="편집"]') !== null
      ) {
        event.preventDefault();
      }
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>): void => {
      clickCapture(event);
      if (!event.defaultPrevented) selection.captureClick(event);
    },
    onContextMenu: (event: MouseEvent<HTMLDivElement>): void => {
      const id = serviceOrderRowId(event.target);
      if (id === null || workspace === 'show') return;
      event.preventDefault();
      openMenu(id, event.currentTarget, targets => ({
        ...pointerMenuAnchor(event),
        targets,
      }));
    },
    onDoubleClick: (event: MouseEvent<HTMLDivElement>): void => {
      if (isInTextEntry(event.target)) return;
      openOrderEditor(serviceOrderRowId(event.target));
    },
    onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>): void => {
      if (isInTextEntry(event.target)) return;
      selection.captureKey(event);
      if (event.defaultPrevented) return;
      if (event.key === 'Enter' && !hasModifier(event)) {
        openOrderEditor(serviceOrderRowId(event.target));
      }
      const id = serviceOrderRowId(event.target);
      if (workspace === 'prep' && id !== null && takeMenuKey(event)) {
        openMenu(id, event.currentTarget, targets => ({
          ...contextMenuAnchor(event),
          targets,
        }));
      }
    },
  };
}
