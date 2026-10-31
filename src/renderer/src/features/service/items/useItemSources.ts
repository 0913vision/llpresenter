import {useMemo} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SettingsName} from '@core/schema/settingsDocuments';
import {useFollowedDocument} from './useFollowedDocument';

export function useItemSettings(
  api: LlpApi['settings'],
  name: SettingsName,
  enabled = true,
) {
  const source = useMemo(
    () => ({
      read: async () => {
        const document = await api.get({name});
        if (document.name !== name) {
          throw new Error(`Unexpected ${name} settings reply`);
        }
        return document;
      },
      follow: (accept: Parameters<typeof api.subscribe>[0]) =>
        api.subscribe(document => {
          if (document.name === name) accept(document);
        }),
    }),
    [api, name],
  );
  return useFollowedDocument(source, enabled);
}

export function useItemMedia(api: LlpApi['media'], enabled = true) {
  return useFollowedDocument(
    useMemo(
      () => ({
        read: () => api.get(),
        follow: (accept: Parameters<typeof api.subscribe>[0]) =>
          api.subscribe(accept),
      }),
      [api],
    ),
    enabled,
  );
}
