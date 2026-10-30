import {expect, it, vi} from 'vitest';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {setAudioLoop} from './audioLoop';

const id = '00000000-0000-4000-8000-000000000001';
function document(revision = 1, loop = false) {
  const parsed = parseMediaDocument({
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [
        {id, name: `List ${revision}`, loop, items: [], future: true},
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid fixture');
  return parsed.value;
}

it('waits for a pending read on close and retries against the current playlist', async () => {
  const read = deferred<ReturnType<typeof document>>();
  const get = vi
    .fn()
    .mockReturnValueOnce(read.promise)
    .mockResolvedValue(document(2));
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Stale'},
    })
    .mockResolvedValueOnce({ok: true, value: {id, revision: 3}});
  const api = fakeLlpApi({media: {get, edit}});
  const playlist = document().value.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  const saving = setAudioLoop(api, playlist.id, true);
  let flushed = false;
  const flush = pendingWritesOf(api)
    .flush()
    .then(value => {
      flushed = true;
      return value;
    });
  await Promise.resolve();
  expect(flushed).toBe(false);
  read.resolve(document());
  await expect(saving).resolves.toMatchObject({ok: true});
  await expect(flush).resolves.toBe(true);
  expect(edit).toHaveBeenLastCalledWith({
    type: 'media.playlist.update',
    baseRevision: 2,
    playlist: {
      kind: 'audio',
      value: {...document(2).value.audioPlaylists[0], loop: true},
    },
  });
});

it('treats a write failure as applied and does not rewrite an unchanged value', async () => {
  const get = vi.fn().mockResolvedValue(document());
  const edit = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      reason: 'write-failed',
      message: 'Disk',
      applied: {id, revision: 2},
    },
  });
  const api = fakeLlpApi({media: {get, edit}});
  const playlist = document().value.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  await expect(setAudioLoop(api, playlist.id, true)).resolves.toMatchObject({
    ok: false,
    error: {reason: 'write-failed'},
  });
  expect(await pendingWritesOf(api).flush()).toBe(true);
  pendingWritesOf(api).resume();
  edit.mockClear();
  await expect(setAudioLoop(api, playlist.id, false)).resolves.toMatchObject({
    ok: true,
  });
  expect(edit).not.toHaveBeenCalled();
});

it('refuses a removed playlist or read-only document without writing', async () => {
  const original = document();
  const playlist = original.value.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  const get = vi
    .fn()
    .mockResolvedValueOnce({
      ...original,
      value: {...original.value, audioPlaylists: []},
    })
    .mockResolvedValueOnce({...original, access: 'read-only'});
  const edit = vi.fn();
  const api = fakeLlpApi({media: {get, edit}});
  await expect(setAudioLoop(api, playlist.id, true)).rejects.toThrow(
    'no longer exists',
  );
  await expect(setAudioLoop(api, playlist.id, true)).rejects.toThrow(
    'read-only',
  );
  expect(edit).not.toHaveBeenCalled();
});
