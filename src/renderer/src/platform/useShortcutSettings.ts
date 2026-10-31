import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {commandBindingStore} from '@renderer/ui/commandBindings';

/** Follows shortcut overrides without letting an older initial read win a push. */
export function useShortcutSettings(api: LlpApi | undefined): void {
  useEffect(() => {
    if (api === undefined) return undefined;
    let active = true;
    let revision = -1;
    const accept: Parameters<LlpApi['settings']['subscribe']>[0] = document => {
      if (
        !active ||
        document.name !== 'shortcuts' ||
        document.revision <= revision
      ) {
        return;
      }
      revision = document.revision;
      commandBindingStore.set(document.value.bindings);
    };
    const stop = api.settings.subscribe(accept);
    void api.settings
      .get({name: 'shortcuts'})
      .then(accept)
      .catch((error: unknown) => {
        if (active) {
          api.log.write({
            level: 'error',
            message: 'Could not load shortcut settings',
            detail: String(error),
          });
        }
      });
    return () => {
      active = false;
      stop();
      commandBindingStore.set({});
    };
  }, [api]);
}
