import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

/**
 * Ctrl D and the 편집 menu's 복제 for a list: `itemAt` names the entry under the focus
 * (nothing when the focus is elsewhere), `reason` is why 복제 can't run now.
 * The key and the right-click row call the same `run`.
 */
export function useDuplicateShortcut<T>({
  itemAt,
  reason,
  reasonOf,
  run,
}: {
  readonly itemAt: (event: KeyboardEvent) => T | undefined;
  readonly reason?: string | undefined;
  /** A reason that depends on the entry, such as a cap of its own kind. */
  readonly reasonOf?: ((item: T) => string | undefined) | undefined;
  readonly run: (item: T) => void;
}): void {
  const why = (item: T | undefined): string | undefined =>
    item === undefined ? reason : (reasonOf?.(item) ?? reason);
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event => itemAt(event) !== undefined,
      unavailable: event => why(itemAt(event)),
      run: event => {
        const item = itemAt(event);
        if (item !== undefined && why(item) === undefined) run(item);
      },
    },
  ]);
}

/**
 * The place of the list entry that holds the focus among the `[role="option"]`
 * rows of `root`, or undefined when the focus is outside them.
 */
export function focusedOptionIndex(
  root: Element | null,
  target: EventTarget | null,
): number | undefined {
  if (root === null || !(target instanceof Element)) return undefined;
  const option = target.closest('[role="option"]');
  if (option === null || !root.contains(option)) return undefined;
  const at = Array.from(root.querySelectorAll('[role="option"]')).indexOf(
    option,
  );
  return at < 0 ? undefined : at;
}
