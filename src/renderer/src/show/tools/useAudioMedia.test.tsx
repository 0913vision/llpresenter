import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaDocument, type MediaDocument} from '@shared/schema/mediaEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {deferred} from '../quick/quickTesting';
import {useAudioMedia} from './useAudioMedia';

afterEach(() => {
  cleanup();
  delete window.llp;
});
function document(revision: number): MediaDocument {
  const result = parseMediaDocument({
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!result.ok) throw new Error('Invalid media fixture');
  return result.value;
}

it('keeps the newest pushed document when the initial read resolves late and unsubscribes', async () => {
  const read = deferred<MediaDocument>();
  const stop = vi.fn();
  let push: (value: MediaDocument) => void = () => undefined;
  window.llp = fakeLlpApi({
    media: {
      get: () => read.promise,
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
  });
  const {result, unmount} = renderHook(() => useAudioMedia(undefined));
  act(() => push(document(2)));
  await act(async () => {
    read.resolve(document(1));
    await read.promise;
  });
  expect(result.current?.revision).toBe(2);
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it('reports a failed initial read', async () => {
  const report = vi.fn();
  window.llp = fakeLlpApi({
    media: {
      get: async () => {
        throw new Error('unavailable');
      },
    },
  });
  renderHook(() => useAudioMedia(report));
  await waitFor(() => expect(report).toHaveBeenCalledOnce());
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({key: 'audio:load'}),
  );
});
