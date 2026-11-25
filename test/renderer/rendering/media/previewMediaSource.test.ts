import {expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import type {MediaProgress} from '@core/schema/media/mediaProgress';
import {APP_PICTURE_IDS} from '@core/theme';
import {previewMediaOf} from '@renderer/rendering/media/previewMedia';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  mediaDocument,
  mediaId,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';

const VIDEO = mediaItem(1, {kind: 'video', duration: 30});
const PICTURE = mediaItem(2, {kind: 'image', file: 'invented-2.png'});
const SONG = mediaItem(3, {kind: 'audio', file: 'invented-3.mp3'});

/** The media API of a window, with the list main sends and its playback samples. */
function setup(
  document: MediaDocument = mediaDocument([VIDEO, PICTURE, SONG]),
) {
  let progress: MediaProgress | null = null;
  const progressListeners = new Set<(value: MediaProgress | null) => void>();
  const listeners = new Set<(value: MediaDocument) => void>();
  let answer: (value: MediaDocument) => void = () => undefined;
  const answered = new Promise<MediaDocument>(resolve => {
    answer = resolve;
  });
  const api: LlpApi = mockLlpApi({
    media: {
      get: () => answered,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    live: {
      mediaProgress: async () => progress,
      subscribeMediaProgress: listener => {
        progressListeners.add(listener);
        return () => progressListeners.delete(listener);
      },
    },
  });
  return {
    api,
    read: () => answer(document),
    push: (next: MediaDocument) => {
      for (const listener of listeners) listener(next);
    },
    sample: (next: MediaProgress | null) => {
      progress = next;
      for (const listener of progressListeners) listener(next);
    },
  };
}

it('has one source for a window, and none without the app', () => {
  const {api} = setup();
  expect(previewMediaOf(api)).toBe(previewMediaOf(api));
  expect(previewMediaOf(undefined)).toBeUndefined();
});

it('shows a picture by its file, a video by its still, and nothing for a sound', async () => {
  const window = setup();
  const source = previewMediaOf(window.api);
  window.read();
  expect(await source?.url(PICTURE.id)).toBe(mediaUrl(PICTURE.id));
  expect(source?.peek(VIDEO.id)).toBe(thumbnailUrl(VIDEO.id));
  expect(source?.peek(SONG.id)).toBeUndefined();
  expect(source?.peek(APP_PICTURE_IDS.scripture)).toBe(
    mediaUrl(APP_PICTURE_IDS.scripture),
  );
  await expect(source?.url(mediaId(9))).rejects.toThrow('No preview picture');
});

it('waits for the media list before it answers, and follows a newer list only', async () => {
  const window = setup(mediaDocument([], 2));
  const source = previewMediaOf(window.api);
  const asked = source?.url(PICTURE.id);
  window.push(mediaDocument([PICTURE], 3));
  expect(await asked).toBe(mediaUrl(PICTURE.id));
  window.read();
  window.push(mediaDocument([], 1));
  expect(source?.peek(PICTURE.id)).toBe(mediaUrl(PICTURE.id));
});

it('counts a still down from its start, and a playing video by main samples of that very playback', async () => {
  const window = setup();
  const source = previewMediaOf(window.api);
  window.read();
  await source?.url(VIDEO.id);
  const still = {mediaId: VIDEO.id, loop: false, startedAt: 0};
  expect(source?.remaining({...still, positionSeconds: 12})).toBe(18);
  expect(source?.remaining({...still, mediaId: PICTURE.id})).toBeUndefined();

  const playing = {mediaId: VIDEO.id, loop: false, startedAt: 5000};
  expect(source?.remaining(playing)).toBeUndefined();
  window.sample({
    mediaId: VIDEO.id,
    startedAt: 5000,
    positionSeconds: 10,
    durationSeconds: 30,
  });
  await vi.waitFor(() => expect(source?.remaining(playing)).toBe(20));
  expect(source?.remaining({...playing, startedAt: 6000})).toBeUndefined();
});
