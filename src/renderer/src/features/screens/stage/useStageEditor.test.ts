import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {stageLayoutsDocument} from '../testing/documents';
import {useStageEditor} from './useStageEditor';

afterEach(() => {
  cleanup();
  delete window.llp;
});

function setup() {
  const document = stageLayoutsDocument();
  if (document.name !== 'stage-layouts') {
    throw new Error('Expected stage layouts');
  }
  const edit = vi.fn(() =>
    Promise.resolve({
      ok: false as const,
      error: {reason: 'stale' as const, message: 'Changed'},
    }),
  );
  window.llp = fakeLlpApi({settings: {edit}});
  return {document, edit};
}

it('retains a shared warning callback when one consumer unmounts before a rejected write', async () => {
  const {document, edit} = setup();
  const problem = vi.fn();
  const panel = renderHook(() => useStageEditor(document, problem));
  const canvas = renderHook(() => useStageEditor(document, problem));
  canvas.unmount();
  act(() => panel.result.current(editor => editor.create()));
  await waitFor(() => expect(problem).toHaveBeenCalledTimes(1));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(problem).toHaveBeenCalledWith(
    expect.objectContaining({
      key: 'stage:save',
      title: '무대 배치 저장 실패',
    }),
  );
});

it('reports once to a shared callback while both consumers remain mounted', async () => {
  const {document} = setup();
  const problem = vi.fn();
  const panel = renderHook(() => useStageEditor(document, problem));
  renderHook(() => useStageEditor(document, problem));
  act(() => panel.result.current(editor => editor.create()));
  await waitFor(() => expect(problem).toHaveBeenCalledTimes(1));
});

it('removes only the warning callback owned by an unmounted consumer', async () => {
  const {document} = setup();
  const firstProblem = vi.fn();
  const secondProblem = vi.fn();
  const first = renderHook(() => useStageEditor(document, firstProblem));
  const second = renderHook(() => useStageEditor(document, secondProblem));
  first.unmount();
  act(() => second.result.current(editor => editor.create()));
  await waitFor(() => expect(secondProblem).toHaveBeenCalledTimes(1));
  expect(firstProblem).not.toHaveBeenCalled();
});
