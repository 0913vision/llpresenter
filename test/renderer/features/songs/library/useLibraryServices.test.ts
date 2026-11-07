import {act, renderHook} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {useLibrary} from '@renderer/features/songs/library/useLibrary';
import {useLibraryServices} from '@renderer/features/songs/library/useLibraryServices';

beforeEach(() => applyService(null));

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
