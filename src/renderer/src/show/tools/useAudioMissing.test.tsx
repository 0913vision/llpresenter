import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaList} from '@shared/schema/mediaList';
import type {MediaId} from '@shared/schema/ids';
import {expectSuccess} from '@shared/schema/testHelpers';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {deferred} from '../quick/quickTesting';
import {useAudioMissing} from './useAudioMissing';

afterEach(() => {
  cleanup();
  delete window.llp;
});
it('keeps a pushed missing-file result over an older read and stops following it', async () => {
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Track',
            kind: 'audio',
            file: 'track.wav',
            size: 1,
          },
        ],
        playlists: [],
        audioPlaylists: [],
      }),
      'media.json',
    ),
  );
  const id = data.items[0]?.id;
  if (!id) throw new Error('Missing media fixture');
  const read = deferred<readonly MediaId[]>();
  let push: (ids: readonly MediaId[]) => void = () => undefined;
  const stop = vi.fn();
  window.llp = fakeLlpApi({
    media: {
      missing: () => read.promise,
      subscribeMissing: listener => {
        push = listener;
        return stop;
      },
    },
  });
  const {result, unmount} = renderHook(() => useAudioMissing(undefined));
  act(() => push([id]));
  await act(async () => {
    read.resolve([]);
    await read.promise;
  });
  expect(result.current.has(id)).toBe(true);
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});
