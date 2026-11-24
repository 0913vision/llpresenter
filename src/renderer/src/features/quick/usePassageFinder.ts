import {useRef, useSyncExternalStore, type KeyboardEvent} from 'react';
import {commandBindings, editsText, matchesBinding} from '@core/shortcuts';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {beginOutputRequest} from '@renderer/session/show/showOutput';
import {commandBindingStore} from '@renderer/ui/keys/commandBindings';
import {isInputMethodKey} from '@renderer/ui/keys/commandDispatcher';

/**
 * The passage finder of quick run, the dialog that 성경 구절 찾기 (Ctrl B)
 * opens. Pressed again while it is open, the key puts the focus back in 책 with
 * its text selected, so typing never falls through to 진행; Esc closes it.
 * A closed finder cancels what it was opening.
 */
export function usePassageFinder({
  open,
  setOpen,
  onClose,
}: {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** Cancels what the finder was about to do once it is gone. */
  readonly onClose: () => void;
}) {
  /** Counts the closes, so an answer for an earlier finder is dropped. */
  const generation = useRef(0);
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const close = (): void => {
    generation.current += 1;
    beginOutputRequest();
    onClose();
    setOpen(false);
  };
  useWindowShortcuts([
    {
      id: 'bible.focus',
      run: () => {
        if (!open) setOpen(true);
      },
    },
  ]);
  /** Takes the finder's own key inside it: back to 책, text selected. */
  const focusOnOwnKey = (event: KeyboardEvent<HTMLElement>): void => {
    const own =
      !isInputMethodKey(event.nativeEvent) &&
      !editsText(event.nativeEvent) &&
      commandBindings('bible.focus', bindings).some(binding =>
        matchesBinding(event.nativeEvent, binding),
      );
    if (!own) return;
    event.preventDefault();
    event.stopPropagation();
    const book = event.currentTarget.querySelector<HTMLInputElement>(
      '[data-reference-part="book"]',
    );
    book?.focus();
    book?.select();
  };
  return {
    close,
    focusOnOwnKey,
    /** Which finder a request belongs to, to drop a late answer. */
    generation: (): number => generation.current,
  };
}
