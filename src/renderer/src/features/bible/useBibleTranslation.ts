import type {LlpApi} from '@contracts/ipc/api';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';

export function useBibleTranslation(api: Pick<LlpApi, 'settings'>) {
  const bible = useApiSettingsDocument({api, name: 'bible', title: '성경'});
  return (
    bible?.value.translations.find(translation => translation.default) ??
    bible?.value.translations[0]
  )?.id;
}
