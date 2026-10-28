import type {LlpApi} from '@shared/ipc';
import type {AudioPlaylistId} from '@shared/schema/ids';
import type {EditResult} from '@shared/schema/contentEdit';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {withinLookupTimeout} from '@renderer/state/showOutput';

const ATTEMPTS = 2;

export async function setAudioLoop(
  api: LlpApi,
  playlistId: AudioPlaylistId,
  loop: boolean,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => saveLoop(api, playlistId, loop),
    refused: null,
    sent: value =>
      value !== null && (value.ok || value.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Playlist edits stopped for closing');
  return result;
}

async function saveLoop(
  api: LlpApi,
  playlistId: AudioPlaylistId,
  loop: boolean,
): Promise<EditResult> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const document = await withinLookupTimeout(() => api.media.get());
    if (document.access !== 'editable') throw new Error('Media is read-only');
    const playlist = document.value.audioPlaylists.find(
      p => p.id === playlistId,
    );
    if (!playlist) throw new Error('Audio playlist no longer exists');
    if (playlist.loop === loop) {
      return {ok: true, value: {id: playlistId, revision: document.revision}};
    }
    const result = await api.media.edit({
      type: 'media.playlist.update',
      playlist: {kind: 'audio', value: {...playlist, loop}},
      baseRevision: document.revision,
    });
    if (result.ok) {
      if (result.value === null) {
        throw new Error('Playlist update was cancelled');
      }
      return {ok: true, value: result.value};
    }
    if (result.error.reason === 'write-failed') return result;
    if (result.error.reason !== 'stale' || attempt + 1 === ATTEMPTS) {
      throw new Error(result.error.message);
    }
  }
  throw new Error('Could not update playlist');
}
