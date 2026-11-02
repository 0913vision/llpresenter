import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import type {
  ServiceChange,
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {useServiceTableData} from '@renderer/features/service/table/useServiceTableData';

const SERVICE_ID = createServiceId('00000000-0000-4000-8000-000000000001');
const FIRST = createSongId('20000000-0000-4000-8000-000000000001');
const SECOND = createSongId('20000000-0000-4000-8000-000000000002');
const ITEM_A = createServiceItemId('10000000-0000-4000-8000-000000000001');
const ITEM_B = createServiceItemId('10000000-0000-4000-8000-000000000002');

afterEach(cleanup);

function serviceOf(
  revision: number,
  order: ServiceDocument['service']['order'],
): ServiceDocument {
  return {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: 'Invented service',
      date: '2026-11-02T11:00',
      order,
    },
    revision,
    access: 'editable',
  };
}

it('drops the facts of a song that no item uses any more', async () => {
  let document = serviceOf(1, [
    {id: ITEM_A, song: FIRST},
    {id: ITEM_B, song: SECOND},
  ]);
  const listeners = new Set<(change: ServiceChange) => void>();
  const api = mockLlpApi({
    services: {
      get: () => Promise.resolve(document),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    songs: {
      get: (id): Promise<SongDocument> =>
        Promise.resolve({
          song: {
            ...sampleGroupedSong(),
            id: id === SECOND ? SECOND : FIRST,
          },
          revision: 1,
          access: 'editable',
        }),
    },
    settings: {
      get: ({name}) => Promise.resolve(settingsDocument(name, {})),
    },
  });
  const {result} = renderHook(() => useServiceTableData(api, SERVICE_ID));
  await waitFor(() => expect(result.current.songs.size).toBe(2));

  document = serviceOf(2, [{id: ITEM_A, song: FIRST}]);
  act(() => {
    for (const listener of listeners) {
      listener({serviceId: SERVICE_ID, document});
    }
  });
  await waitFor(() => expect(result.current.songs.size).toBe(1));
  expect([...result.current.songs.keys()]).toEqual([FIRST]);
});
