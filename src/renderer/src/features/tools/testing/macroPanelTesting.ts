import {settingsDocument} from '@core/testing/settingsDocument';
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@core/schema/contentDocuments';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {stageFixture} from '../stageTesting';
import type {MacroPanelModel} from '../useMacroPanel';

export const id = '00000000-0000-4000-8000-000000000001';
const groupId = '00000000-0000-4000-8000-000000000002';
const serviceId = '00000000-0000-4000-8000-000000000003';
export const macro = {
  id,
  name: '찬양',
  icon: 'macro',
  color: 'teal',
  actions: [],
};
export const group = {id: groupId, name: '주일', macroIds: [id]};
const entries = parseServiceEntries([
  {id: serviceId, name: '예배', date: '2026-11-01T11:00', access: 'editable'},
]);
const service = parseServiceDocument({
  revision: 1,
  access: 'editable',
  service: {
    format: 'llservice',
    schemaVersion: 1,
    id: serviceId,
    name: '예배',
    date: '2026-11-01T11:00',
    order: [
      {
        id: '00000000-0000-4000-8000-000000000004',
        media: '00000000-0000-4000-8000-000000000005',
        macro: id,
      },
      {
        id: '00000000-0000-4000-8000-000000000006',
        media: '00000000-0000-4000-8000-000000000005',
        macro: id,
      },
    ],
  },
});
if (!entries.ok || !service.ok || !service.value) {
  throw new Error('Invalid fixture');
}
const serviceEntries = entries.value;
const serviceDocument = service.value;

export function mockMacroPanel(actions: readonly object[] = []) {
  const f = stageFixture([
    settingsDocument('macros', {
      macros: [{...macro, actions}],
      collections: [group],
    }),
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
  ]);
  const api = window.llp;
  if (!api) throw new Error('Missing API');
  const media = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!media.ok) throw new Error('Invalid media');
  window.llp = {
    ...api,
    media: {
      ...api.media,
      get: () => Promise.resolve(media.value),
      subscribe: () => () => undefined,
    },
    services: {
      ...api.services,
      list: () => Promise.resolve(serviceEntries),
      get: () => Promise.resolve(serviceDocument),
    },
  };
  f.edit.mockResolvedValue({ok: true, value: {id: 'macros', revision: 2}});
  return f;
}
export function firstMacro(model: MacroPanelModel) {
  const item = model.macros[0];
  if (!item) throw new Error('Missing macro');
  return item;
}

export function firstCollection(model: MacroPanelModel) {
  const item = model.collections[0];
  if (!item) throw new Error('Missing collection');
  return item;
}
