import {act, renderHook, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {createServiceItemId} from '@core/schema/ids';
import {useServiceOrderEditing} from '@renderer/features/service/order/useServiceOrderEditing';
import {libraryFixture} from './fixture';
import {pastDocument, serviceEntries} from '@core/testing/serviceList';
import {useLibraryServices} from './useLibraryServices';

it('undoes a library append from the service list and restores earlier edit history', async () => {
  const fixture = libraryFixture();
  let document = pastDocument;
  const song = fixture.list()[0];
  const header = pastDocument.service.order[0];
  if (!song || !header) throw new Error('Missing fixture');
  const api = fakeLlpApi({
    songs: fixture.api.songs,
    library: fixture.api.library,
    services: {...fixture.api.services, get: () => Promise.resolve(document)},
    content: {
      edit: command => {
        if (command.type !== 'service.update') {
          throw new Error('Unexpected edit');
        }
        const parsed = parseServiceDocument({
          ...document,
          service: command.service,
          revision: document.revision + 1,
        });
        if (!parsed.ok || parsed.value === null) {
          throw new Error('Invalid service');
        }
        document = parsed.value;
        return Promise.resolve({
          ok: true,
          value: {id: document.service.id, revision: document.revision},
        });
      },
    },
  });
  vi.stubGlobal('llp', api);
  const onProblem = vi.fn();
  const {result} = renderHook(() => ({
    service: useServiceOrderEditing(pastDocument.service.id, onProblem),
    library: useLibraryServices(api, onProblem),
  }));
  act(() =>
    result.current.service.run((edits, id) =>
      edits.remove(id, createServiceItemId(header.id)),
    ),
  );
  await waitFor(() => expect(document.service.order).toHaveLength(1));
  const beforeAppend = document.service.order;
  await act(() =>
    result.current.library.append(pastDocument.service.id, song.id),
  );
  expect(document.service.order).toHaveLength(2);
  act(() => result.current.service.run((edits, id) => edits.undo(id)));
  await waitFor(() => expect(document.service.order).toEqual(beforeAppend));
  act(() => result.current.service.run((edits, id) => edits.undo(id)));
  await waitFor(() =>
    expect(document.service.order).toEqual(pastDocument.service.order),
  );
  expect(onProblem).not.toHaveBeenCalled();
});

it('keeps a pushed service list over an older read and releases its subscription', async () => {
  const {api} = libraryFixture();
  let resolve: ((entries: readonly ServiceEntry[]) => void) | undefined;
  let push: ((entries: readonly ServiceEntry[]) => void) | undefined;
  const stop = vi.fn();
  vi.spyOn(api.services, 'list').mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  vi.spyOn(api.services, 'subscribeList').mockImplementation(listener => {
    push = listener;
    return stop;
  });
  const {result, unmount} = renderHook(() => useLibraryServices(api, vi.fn()));
  act(() => push?.(serviceEntries));
  await act(async () => resolve?.([]));
  expect(result.current.services).toEqual(serviceEntries);
  unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

it('reports an unavailable service list', async () => {
  const {api} = libraryFixture();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(api.services, 'list').mockRejectedValue(new Error('Unavailable'));
  const onProblem = vi.fn();
  const {result} = renderHook(() => useLibraryServices(api, onProblem));
  await waitFor(() =>
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '예배 순서 불러오기 실패',
      }),
    ),
  );
  expect(result.current.services).toEqual([]);
});
