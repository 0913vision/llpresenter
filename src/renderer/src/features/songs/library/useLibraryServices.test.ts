import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {createServiceItemId} from '@core/schema/ids';
import {useServiceOrderEditing} from '@renderer/features/service/order/useServiceOrderEditing';
import {libraryFixture} from './fixture';
import {pastDocument} from '@core/testing/serviceList';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@renderer/session/testing/sampleService';
import {useLibraryServices} from './useLibraryServices';

beforeEach(() => applyService(null));

it('undoes a library append from the service list and restores earlier edit history', async () => {
  const fixture = libraryFixture();
  let document = pastDocument;
  const song = fixture.list()[0];
  const header = pastDocument.service.order[0];
  if (!song || !header) throw new Error('Missing fixture');
  const api = mockLlpApi({
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
  applyService({...sampleService, id: pastDocument.service.id});
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
  await act(() => result.current.library.append(song.id));
  expect(document.service.order).toHaveLength(2);
  act(() => result.current.service.run((edits, id) => edits.undo(id)));
  await waitFor(() => expect(document.service.order).toEqual(beforeAppend));
  act(() => result.current.service.run((edits, id) => edits.undo(id)));
  await waitFor(() =>
    expect(document.service.order).toEqual(pastDocument.service.order),
  );
  expect(onProblem).not.toHaveBeenCalled();
});

it('follows the open service access without enumerating saved service files', async () => {
  const {api} = libraryFixture();
  const enumerate = vi.spyOn(api.services, 'list');
  const edit = vi.spyOn(api.content, 'edit');
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing song');
  const {result} = renderHook(() => useLibraryServices(api, vi.fn()));
  expect(result.current.disabledReason).toBe('열린 예배 순서가 없습니다');
  await act(() => result.current.append(song.id));
  act(() => applyService({...sampleService, readOnly: true}));
  expect(result.current.disabledReason).toBe('읽기 전용 예배 순서입니다');
  await act(() => result.current.append(song.id));
  expect(edit).not.toHaveBeenCalled();
  act(() => useShow.setState({readOnly: false}));
  expect(result.current.disabledReason).toBeUndefined();
  expect(enumerate).not.toHaveBeenCalled();
});
