import type {Macro} from '@core/schema/macros';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import type {MacroEdit} from './macroEdits';

/**
 * Deleting a 매크로, or one or all of its actions, after the operator agrees.
 * Asked from the menu, the question waits until the menu has closed.
 */
export function useMacroRemovals({
  macros,
  locked,
  menuOpen,
  closeMenu,
  focusGrid,
  commit,
}: {
  readonly macros: readonly Macro[];
  readonly locked: boolean;
  readonly menuOpen: boolean;
  readonly closeMenu: () => void;
  /** Keeps the focus in the grid while the deleted tile goes. */
  readonly focusGrid: () => void;
  readonly commit: (edit: MacroEdit) => void;
}) {
  const stillThere = (item: Macro): boolean =>
    !locked && macros.some(value => value.id === item.id);
  const removeMacro = (item: Macro): void =>
    deleteSelection(
      1,
      () => stillThere(item),
      () => {
        focusGrid();
        commit({kind: 'delete', id: item.id});
      },
    );
  const removeActions = ({
    item,
    index,
  }: {
    item: Macro;
    index: number | null;
  }): void =>
    deleteSelection(
      index === null
        ? item.actions.length
        : Number(index >= 0 && index < item.actions.length),
      () => stillThere(item),
      () => {
        focusGrid();
        commit({
          kind: 'action',
          id: item.id,
          action:
            index === null
              ? {kind: 'removeAll', expected: item.actions}
              : {kind: 'remove', index, expected: item.actions},
        });
      },
    );
  const removeAfterMenu = useMenuHandoff<Macro>(menuOpen, removeMacro);
  const removeActionsAfterMenu = useMenuHandoff<{
    item: Macro;
    index: number | null;
  }>(menuOpen, removeActions);
  /** Runs `now` at once, or after the menu has closed when it is open. */
  const viaMenu = <T>(
    handoff: (target: T) => void,
    now: (target: T) => void,
    target: T,
  ): void => {
    if (menuOpen) {
      handoff(target);
      closeMenu();
    } else now(target);
  };
  return {
    /** Asks to delete the 매크로. */
    askDelete: (item: Macro): void =>
      viaMenu(removeAfterMenu, removeMacro, item),
    /** Asks to delete action `index` of the 매크로, or all of them for null. */
    askRemoveActions: (item: Macro, index: number | null): void =>
      viaMenu(removeActionsAfterMenu, removeActions, {item, index}),
  };
}
