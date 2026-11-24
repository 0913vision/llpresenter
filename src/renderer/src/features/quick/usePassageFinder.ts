import {useRef, useSyncExternalStore, type KeyboardEvent} from 'react';
import {commandBindings, editsText, matchesBinding} from '@core/shortcuts';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {isInputMethodKey} from '@renderer/ui/commandDispatcher';

/**
 * The passage finder of quick run, the dialog that 성경 구절 찾기 (Ctrl B)
 * opens. The key that opens it closes it again, like Esc, also from inside
 * while typing. A closed finder cancels what it was opening.
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
        if (open) close();
        else setOpen(true);
      },
    },
  ]);
  /** Closes the finder on its own key, which the dialog would keep. */
  const closeOnOwnKey = (event: KeyboardEvent): void => {
    const own =
      !isInputMethodKey(event.nativeEvent) &&
      !editsText(event.nativeEvent) &&
      commandBindings('bible.focus', bindings).some(binding =>
        matchesBinding(event.nativeEvent, binding),
      );
    if (!own) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) close();
  };
  return {
    close,
    closeOnOwnKey,
    /** Which finder a request belongs to, to drop a late answer. */
    generation: (): number => generation.current,
  };
}
