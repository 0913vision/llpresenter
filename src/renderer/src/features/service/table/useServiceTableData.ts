import {useMemo} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {ServiceItem} from '@core/schema/service';
import type {ThemesFile} from '@core/schema/themes';
import {useFollowedDocument} from '../items/useFollowedDocument';
import {useItemSettings} from '../items/useItemSources';

type Api = Pick<LlpApi, 'services' | 'settings'>;

/** The items of the open 예배 순서 by id, with the lists their cells name. */
export function useServiceTableData(api: Api, serviceId: string | null) {
  const source = useMemo(
    () => ({
      read: async (): Promise<ServiceDocument> => {
        const document =
          serviceId === null ? null : await api.services.get(serviceId);
        if (document === null) throw new Error('The service is not readable');
        return document;
      },
      follow: (accept: (document: ServiceDocument) => void) =>
        api.services.subscribe(change => {
          if (change.serviceId === serviceId && change.document !== null) {
            accept(change.document);
          }
        }),
    }),
    [api, serviceId],
  );
  const service = useFollowedDocument(source, serviceId !== null);
  const themes = useItemSettings(api.settings, 'themes');
  const macros = useItemSettings(api.settings, 'macros');
  const items = useMemo(
    () =>
      new Map<string, ServiceItem>(
        (service.document?.service.order ?? []).map(item => [item.id, item]),
      ),
    [service.document],
  );
  const themeFile: ThemesFile | null =
    themes.document?.name === 'themes' ? themes.document.value : null;
  const macroList =
    macros.document?.name === 'macros' ? macros.document.value.macros : [];
  return {items, themeFile, macroList};
}
