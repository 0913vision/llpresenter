import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useServiceOrderEditing} from './useServiceOrderEditing';

it('requires successful persistence when the header rename was already applied', async () => {
  const edit = vi
    .fn<LlpApi['content']['edit']>()
    .mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'saves', revision: null},
        unchangedFiles: ['service.llservice'],
      },
    })
    .mockResolvedValueOnce({ok: true, value: {id: 'saves', revision: null}});
  vi.stubGlobal('llp', mockLlpApi({content: {edit}}));
  const problem = vi.fn();
  const {result} = renderHook(() =>
    useServiceOrderEditing('00000000-0000-4000-8000-000000000001', problem),
  );
  const unchanged = async () => ({ok: true as const, value: false});
  let saved = false;
  await act(async () => {
    saved = await result.current.save(unchanged);
  });
  expect(saved).toBe(false);
  expect(problem).toHaveBeenCalledOnce();
  await act(async () => {
    saved = await result.current.save(unchanged);
  });
  expect(saved).toBe(true);
  expect(edit).toHaveBeenCalledTimes(2);
  expect(edit).toHaveBeenLastCalledWith({type: 'saves.retry'});
});
