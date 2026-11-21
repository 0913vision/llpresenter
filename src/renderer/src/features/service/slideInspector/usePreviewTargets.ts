import type {LlpApi} from '@contracts/ipc/api';
import {useItemSettings} from '../items/useItemSources';

/** Follow configured screen identities; a failure produces no phantom targets. */
export function usePreviewTargets(api: LlpApi) {
  const settings = useItemSettings(api.settings, 'screens');
  return {
    screens:
      settings.document?.name === 'screens'
        ? settings.document.value.screens
        : [],
    loading: settings.document === null && !settings.failed,
  };
}
