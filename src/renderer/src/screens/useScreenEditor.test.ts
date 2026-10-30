import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useScreenEditor} from './useScreenEditor';
import {useMonitors} from './useMonitors';
import type {NamedDocument} from '../platform/useSettingsDocument';
import {MAIN_ID, STAGE_ID, screensDocument} from './testing/documents';
import {projector} from './testing/monitors';

afterEach(() => {
  cleanup();
  delete window.llp;
});

it('keeps a completed move when a settings push arrives before the old monitor feed changes', async () => {
  const initial = screensDocument();
  if (initial.name !== 'screens') throw new Error('Expected screens');
  const monitor2 = {...projector, number: 2};
  const monitor3 = {...projector, id: 3, number: 3, screenIds: [STAGE_ID]};
  const document: NamedDocument<'screens'> = {
    ...initial,
    value: {
      ...initial.value,
      screens: initial.value.screens.map(screen =>
        screen.id === STAGE_ID
          ? {
              ...screen,
              display: {
                id: 3,
                number: 3,
                name: monitor3.name,
                bounds: monitor3.bounds,
                scaleFactor: monitor3.scaleFactor,
              },
            }
          : screen,
      ),
    },
  };
  const edits: SettingsEdit[] = [];
  window.llp = fakeLlpApi({
    monitors: {get: () => Promise.resolve([monitor2, monitor3])},
    settings: {
      edit: edit => {
        edits.push(edit);
        return Promise.resolve({
          ok: true,
          value: {id: 'screens', revision: edits.length === 1 ? 2 : 4},
        });
      },
    },
  });
  const hook = renderHook(
    ({document}) => ({
      monitors: useMonitors(),
      writer: useScreenEditor(document, undefined),
    }),
    {initialProps: {document}},
  );
  await waitFor(() => expect(hook.result.current.monitors).toHaveLength(2));
  await act(async () => hook.result.current.writer.assign(MAIN_ID, monitor3));
  await waitFor(() => expect(edits).toHaveLength(1));
  const first = edits[0];
  if (first?.name !== 'screens') throw new Error('Expected screen edit');
  hook.rerender({
    document: {...document, value: structuredClone(first.value), revision: 3},
  });
  await act(async () => hook.result.current.writer.assign(STAGE_ID, monitor2));
  await waitFor(() => expect(edits).toHaveLength(2));
  const last = edits[1];
  expect(last).toMatchObject({baseRevision: 3});
  expect(last?.name === 'screens' && last.value.screens[0]?.display?.id).toBe(
    3,
  );
  expect(last?.name === 'screens' && last.value.screens[2]?.display?.id).toBe(
    2,
  );
});

it('serializes property and layout panel edits against one shared revision', async () => {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const edits: SettingsEdit[] = [];
  window.llp = fakeLlpApi({
    settings: {
      edit: edit => {
        edits.push(edit);
        return edits.length === 1
          ? held
          : Promise.resolve({ok: true, value: {id: 'screens', revision: 3}});
      },
    },
  });
  const properties = renderHook(() => useScreenEditor(document, undefined));
  const layout = renderHook(() => useScreenEditor(document, undefined));
  act(() => properties.result.current.change(MAIN_ID, {name: '본당'}));
  await waitFor(() => expect(edits).toHaveLength(1));
  act(() => layout.result.current.assign(STAGE_ID, projector));
  await act(async () => {
    await Promise.resolve();
  });
  expect(edits).toHaveLength(1);
  release({ok: true, value: {id: 'screens', revision: 2}});
  await waitFor(() => expect(edits).toHaveLength(2));
  const last = edits[1];
  expect(last).toMatchObject({baseRevision: 2});
  expect(last?.name === 'screens' && last.value.screens[0]?.name).toBe('본당');
  expect(last?.name === 'screens' && last.value.screens[2]?.display?.id).toBe(
    2,
  );
});

it('releases the unmounted panel reporter while another panel keeps editing', async () => {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  window.llp = fakeLlpApi({
    settings: {
      edit: () =>
        Promise.resolve({
          ok: false,
          error: {reason: 'stale', message: 'Changed'},
        }),
    },
  });
  const firstProblem = vi.fn();
  const secondProblem = vi.fn();
  const first = renderHook(() => useScreenEditor(document, firstProblem));
  const second = renderHook(() => useScreenEditor(document, secondProblem));
  first.unmount();
  act(() => second.result.current.change(MAIN_ID, {name: '본당'}));
  await waitFor(() => expect(secondProblem).toHaveBeenCalledTimes(1));
  expect(firstProblem).not.toHaveBeenCalled();
});
