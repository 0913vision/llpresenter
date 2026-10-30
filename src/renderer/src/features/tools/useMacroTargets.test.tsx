import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaDocument, type MediaDocument} from '@core/schema/mediaEdit';
import {settingsDocument} from '@renderer/features/screens/testing/documents';
import {stageFixture} from './stageTesting';
import {useMacroTargets} from './useMacroTargets';

const id = '00000000-0000-4000-8000-000000000001';
function media(revision: number, name: string): MediaDocument {
  const result = parseMediaDocument({
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [{id, name, kind: 'audio', file: 'music.mp3', size: 1}],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!result.ok) throw new Error('Invalid media fixture');
  return result.value;
}
function fixture() {
  const f = stageFixture([
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
    settingsDocument('macros', {macros: [], collections: []}),
  ]);
  const api = window.llp;
  if (!api) throw new Error('Missing API');
  let listener: ((document: MediaDocument) => void) | undefined;
  let resolve: (value: MediaDocument) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<MediaDocument>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const pending = {promise, resolve, reject};
  const stop = vi.fn();
  window.llp = {
    ...api,
    media: {
      ...api.media,
      get: () => pending.promise,
      subscribe: fn => {
        listener = fn;
        return stop;
      },
    },
  };
  return {f, pending, stop, push: (value: MediaDocument) => listener?.(value)};
}
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

it('uses the latest settings and media while ignoring an older initial reply and releases subscriptions', async () => {
  const {f, pending, stop, push} = fixture();
  const {result, unmount} = renderHook(() => useMacroTargets(undefined));
  await waitFor(() => expect(f.count()).toBe(8));
  act(() => push(media(2, 'New audio')));
  await waitFor(() =>
    expect(result.current?.choices.audio).toEqual([{id, name: 'New audio'}]),
  );
  await act(async () => {
    pending.resolve(media(1, 'Old audio'));
    await pending.promise;
  });
  expect(result.current?.choices.audio).toEqual([{id, name: 'New audio'}]);
  act(() =>
    f.push(
      settingsDocument(
        'props',
        {
          props: [
            {
              id,
              name: 'New prop',
              content: {kind: 'image', media: id},
              targets: [],
            },
          ],
        },
        2,
      ),
    ),
  );
  await waitFor(() =>
    expect(result.current?.choices.prop).toEqual([{id, name: 'New prop'}]),
  );
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  expect(f.count()).toBe(0);
});

it('reports a media read failure and ignores a late failure after an update', async () => {
  const first = fixture();
  const report = vi.fn();
  const view = renderHook(() => useMacroTargets(report));
  await act(async () => {
    first.pending.reject(new Error('read failed'));
    await Promise.allSettled([first.pending.promise]);
  });
  expect(report).toHaveBeenCalledOnce();
  expect(first.f.log).toHaveBeenCalledOnce();
  view.unmount();
  const second = fixture();
  const nextReport = vi.fn();
  renderHook(() => useMacroTargets(nextReport));
  act(() => second.push(media(2, 'New audio')));
  await act(async () => {
    second.pending.reject(new Error('late failure'));
    await Promise.allSettled([second.pending.promise]);
  });
  expect(nextReport).not.toHaveBeenCalled();
});
