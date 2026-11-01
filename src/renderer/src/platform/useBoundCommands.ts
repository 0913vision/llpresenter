import {useSyncExternalStore} from 'react';
import {commandBindingStore} from '@renderer/ui/commandBindings';

/** Reports whether a command prefix has any assigned, nonempty bindings. */
export function useBoundCommands(): (prefix: string) => boolean {
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const ids = Object.keys(bindings).filter(
    id => (bindings[id]?.length ?? 0) > 0,
  );
  return (prefix: string): boolean => ids.some(id => id.startsWith(prefix));
}
