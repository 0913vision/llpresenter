import {describe, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {
  requestSongEditor,
  subscribeSongEditor,
} from '@renderer/features/songs/editor/songEditorRequests';

const target = {songId: createSongId('50000000-0000-4000-8000-000000000001')};

describe('song editor requests', () => {
  it('delivers a pending request once and stops delivery after unsubscribe', async () => {
    await requestSongEditor(target);
    const first = vi.fn();
    const stop = subscribeSongEditor(first);
    expect(first).toHaveBeenCalledExactlyOnceWith(target);
    stop();
    const second = vi.fn();
    const stopSecond = subscribeSongEditor(second);
    expect(second).not.toHaveBeenCalled();
    await requestSongEditor(target);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledExactlyOnceWith(target);
    stopSecond();
  });
});
