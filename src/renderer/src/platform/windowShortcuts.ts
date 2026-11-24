import {
  useCommandShortcuts,
  type WindowShortcut,
} from '@renderer/ui/keys/commandDispatcher';
import {isColumnDragActive} from './drag';

export type {WindowShortcut};

/** Shares the command dispatcher with controls while respecting column drags. */
export function useWindowShortcuts(shortcuts: readonly WindowShortcut[]): void {
  useCommandShortcuts(shortcuts, isColumnDragActive);
}
