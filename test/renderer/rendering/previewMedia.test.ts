import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  mediaDocument,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import type {MediaProgress} from '@core/schema/mediaProgress';
import type {MediaDocument} from '@core/schema/mediaEdit';

afterEach(() => vi.useRealTimers());

it('shares a metadata feed, preserves image files, and uses cached stills only for video', async () => {
  const image = mediaItem(1, {
    kind: 'image',
    file: 'transparent-portrait.png',
    width: 200,
    height: 600,
  });
  const video = mediaItem(2, {duration: 12});
  const stop = vi.fn();
  const get = vi.fn(async () => mediaDocument([image, video]));
  const subscribe = vi.fn(() => stop);
  const stopProgress = vi.fn();
  const subscribeProgress = vi.fn(() => stopProgress);
  const progress = vi.fn(async () => null);
  const api = mockLlpApi({
    media: {get, subscribe},
    live: {mediaProgress: progress, subscribeMediaProgress: subscribeProgress},
  });
  const first = openPreviewMedia(api);
  const second = openPreviewMedia(api);
  if (first === undefined || second === undefined) {
    throw Error('Missing preview sources');
  }
  expect(get).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
  expect(subscribeProgress).not.toHaveBeenCalled();
  expect(await first.url(image.id)).toBe(mediaUrl(image.id));
  expect(await second.url(video.id)).toBe(thumbnailUrl(video.id));
  expect(get).toHaveBeenCalledOnce();
  expect(subscribe).toHaveBeenCalledOnce();
  expect(progress).toHaveBeenCalledOnce();
  expect(subscribeProgress).toHaveBeenCalledOnce();
  first.dispose();
  expect(stop).not.toHaveBeenCalled();
  expect(stopProgress).not.toHaveBeenCalled();
  second.dispose();
  second.dispose();
  expect(stop).toHaveBeenCalledOnce();
  expect(stopProgress).toHaveBeenCalledOnce();
});

it('keeps a newer main progress push when the initial progress query finishes later', async () => {
  const video = mediaItem(1, {duration: 12});
  const sample = {
    mediaId: video.id,
    startedAt: 1000,
    positionSeconds: 3,
    durationSeconds: 12,
  };
  let resolveProgress: ((reading: MediaProgress | null) => void) | undefined;
  let push: ((reading: MediaProgress | null) => void) | undefined;
  const api = mockLlpApi({
    media: {get: async () => mediaDocument([video])},
    live: {
      mediaProgress: () =>
        new Promise<MediaProgress | null>(resolve => {
          resolveProgress = resolve;
        }),
      subscribeMediaProgress: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  const source = openPreviewMedia(api);
  const picture = source?.url(video.id);
  if (
    source === undefined ||
    push === undefined ||
    resolveProgress === undefined
  ) {
    throw Error('Missing progress feed');
  }
  push(sample);
  resolveProgress({...sample, positionSeconds: 0});
  await picture;
  expect(
    source.remaining({mediaId: video.id, startedAt: 1000, loop: true}),
  ).toBe(9);
  source.dispose();
});

it('reads main progress without advancing a local clock and keeps preparation stills at their starting position', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  const video = mediaItem(1, {duration: 12});
  const sample = {
    mediaId: video.id,
    startedAt: now,
    positionSeconds: 3,
    durationSeconds: 12,
  };
  let push: ((reading: MediaProgress | null) => void) | undefined;
  const api = mockLlpApi({
    media: {get: async () => mediaDocument([video])},
    live: {
      mediaProgress: async () => sample,
      subscribeMediaProgress: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  const source = openPreviewMedia(api);
  if (source === undefined) throw Error('Missing preview sources');
  await source.url(video.id);
  const media = {mediaId: video.id, loop: true, startedAt: now};
  expect(source.remaining(media)).toBe(9);
  vi.advanceTimersByTime(2000);
  expect(source.remaining(media)).toBe(9);
  push?.({...sample, positionSeconds: 5});
  expect(source.remaining(media)).toBe(7);
  expect(source.remaining({...media, startedAt: now + 1})).toBeUndefined();
  expect(source.remaining({...media, startedAt: 0})).toBe(12);
  source.dispose();
});

it('ignores an older initial query after a newer media push', async () => {
  const image = mediaItem(1, {kind: 'image', file: 'portrait.png'});
  const older = mediaDocument([{...image, kind: 'video'}], 1);
  const newer = mediaDocument([image], 2);
  let resolveGet: ((document: MediaDocument) => void) | undefined;
  let push: ((document: MediaDocument) => void) | undefined;
  const api = mockLlpApi({
    media: {
      get: () =>
        new Promise<MediaDocument>(resolve => {
          resolveGet = resolve;
        }),
      subscribe: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  const source = openPreviewMedia(api);
  const picture = source?.url(image.id);
  if (source === undefined || push === undefined || resolveGet === undefined) {
    throw Error('Missing media feed');
  }
  push(newer);
  resolveGet(older);
  expect(await picture).toBe(mediaUrl(image.id));
  source.dispose();
});

it('settles pending source requests when the last preview is disposed', async () => {
  const stop = vi.fn();
  const api = mockLlpApi({
    media: {
      get: () => new Promise<MediaDocument>(() => undefined),
      subscribe: () => stop,
    },
  });
  const source = openPreviewMedia(api);
  if (source === undefined) throw Error('Missing media feed');
  const request = source.url(mediaItem(1).id);
  source.dispose();
  await expect(request).rejects.toThrow('No preview picture');
  expect(stop).toHaveBeenCalledOnce();
});
