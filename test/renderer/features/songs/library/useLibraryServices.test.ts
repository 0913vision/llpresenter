import {act, renderHook} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {useLibrary} from '@renderer/features/songs/library/useLibrary';
import {useLibraryServices} from '@renderer/features/songs/library/useLibraryServices';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';

beforeEach(() => applyService(null));

it('inserts a library song immediately after the selected service row and selects it on the projection', async () => {
  const fixture = itemFixture();
  const rows = [
    {kind: 'song' as const, id: fixtureItems.arranged, title: '첫 곡'},
    {kind: 'song' as const, id: fixtureItems.plain, title: '다음 곡'},
  ];
  act(() =>
    useShow.setState({
      serviceId: fixtureServiceId,
      readOnly: false,
      openItemId: fixtureItems.arranged,
      rows,
    }),
  );
  const {result} = renderHook(() => useLibraryServices(fixture.api, vi.fn()));
  await act(() => result.current.append(fixture.first.song.id));
  const order = fixture.service().service.order;
  const at = order.findIndex(item => item.id === fixtureItems.arranged);
  const added = order[at + 1];
  expect(added).toMatchObject({
    song: fixture.first.song.id,
    slides: fixture.first.song.slides,
  });
  expect(order[at + 2]?.id).toBe(fixtureItems.plain);
  if (added === undefined) throw new Error('Missing added song');
  act(() =>
    useShow.setState({
      rows: [...rows, {kind: 'song', id: added.id, title: '추가한 곡'}],
    }),
  );
  expect(useShow.getState().openItemId).toBe(added.id);
});

it('follows the open service access without enumerating saved service files', async () => {
  const {api} = libraryFixture();
  const enumerate = vi.spyOn(api.services, 'list');
  const edit = vi.spyOn(api.content, 'edit');
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing song');
  const {result} = renderHook(() => useLibraryServices(api, vi.fn()));
  expect(result.current.disabledReason).toBe('열린 예배 없음');
  await act(() => result.current.append(song.id));
  act(() => applyService({...sampleService, readOnly: true}));
  expect(result.current.disabledReason).toBe(
    '새 버전의 파일이라 바꿀 수 없습니다',
  );
  await act(() => result.current.append(song.id));
  expect(edit).not.toHaveBeenCalled();
  act(() => useShow.setState({readOnly: false}));
  expect(result.current.disabledReason).toBeUndefined();
  expect(enumerate).not.toHaveBeenCalled();
});

it('shows 예배 순서에 추가하는 중 while the write runs and reports its failure after the library is gone', async () => {
  const {api} = libraryFixture();
  const song = libraryFixture().list()[0];
  if (!song) throw new Error('Missing song');
  act(() =>
    applyService({
      ...sampleService,
      id: '00000000-0000-4000-8000-000000000001',
    }),
  );
  let finish: (reply: {
    ok: false;
    error: {reason: 'invalid'; message: string};
  }) => void = () => undefined;
  vi.spyOn(api.content, 'edit').mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const onProblem = vi.fn();
  const {result, unmount} = renderHook(() =>
    useLibraryServices(api, onProblem),
  );

  let appending: Promise<void> = Promise.resolve();
  act(() => {
    appending = result.current.append(song.id);
  });
  expect(result.current.disabledReason).toBe('예배 순서에 추가하는 중');
  unmount();
  finish({ok: false, error: {reason: 'invalid', message: 'Invented'}});
  await appending;

  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({
      key: 'library:append',
      title: '예배 순서에 추가 실패',
    }),
  );
});

it('reports a failed song creation after the library panel is gone', async () => {
  const {api} = libraryFixture();
  let finish: (reply: {
    ok: false;
    error: {reason: 'invalid'; message: string};
  }) => void = () => undefined;
  vi.spyOn(api.content, 'edit').mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const onProblem = vi.fn();
  const {result, unmount} = renderHook(() =>
    useLibrary(api, vi.fn(), onProblem),
  );

  let creating: Promise<void> = Promise.resolve();
  act(() => {
    creating = result.current.create();
  });
  unmount();
  finish({ok: false, error: {reason: 'invalid', message: 'Invented'}});
  await creating;

  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({key: 'library:change'}),
  );
});
