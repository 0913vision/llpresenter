import {act, renderHook} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {useLibraryServices} from '@renderer/features/songs/library/useLibraryServices';

beforeEach(() => applyService(null));

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
