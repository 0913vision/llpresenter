import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {createMediaId, type MediaId} from '@core/schema/common/ids';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import type {ShowService} from '@core/schema/services/showService';
import type {Slide} from '@core/schema/slides/slide';
import {slideTiles} from '@core/slides/tiles';
import {MediaPreloader} from '@renderer/output/mediaPreloader';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {lyricsSlide} from '@fixtures/core/slides';
import {themesDocument} from '@fixtures/core/themeOutput';

function media(number: number) {
  return createMediaId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}
function slide(number: number, id: MediaId): Slide {
  return lyricsSlide(number, '가사', {background: {kind: 'media', media: id}});
}

const loads: string[] = [];
const finishes: Array<() => void> = [];
const failures: Array<(error: Error) => void> = [];

beforeEach(() => {
  loads.length = 0;
  finishes.length = 0;
  failures.length = 0;
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    loads.push(this.src.slice(-12).replace(/^0+/u, ''));
    return new Promise((resolve, reject) => {
      finishes.push(resolve);
      failures.push(reject);
    });
  });
});
afterEach(() => vi.useRealTimers());

/** Hands a new media list to the preloader of the last setup. */
let changeMedia: (document: MediaDocument) => void = () => undefined;

async function setup(
  decks: Readonly<Record<string, readonly Slide[]>>,
  videos: readonly MediaId[] = [],
) {
  const service: ShowService = {
    id: 'service',
    revision: 1,
    name: '예배',
    readOnly: false,
    rows: Object.keys(decks).map(id => ({kind: 'song', id, title: id})),
    tiles: Object.fromEntries(
      Object.entries(decks).map(([id, slides]) => [
        id,
        slideTiles(slides, {kind: 'song', title: id}),
      ]),
    ),
  };
  const document: MediaDocument = {
    name: 'media',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: videos.map(id => ({
        id,
        kind: 'video',
        name: id,
        file: `${id}.mp4`,
        size: 0,
      })),
      playlists: [],
      audioPlaylists: [],
    },
    revision: 1,
    access: 'editable',
  };
  const api: LlpApi = mockLlpApi({
    service: {
      get: () => Promise.resolve(service),
      subscribe: () => () => undefined,
    },
    media: {
      get: () => Promise.resolve(document),
      subscribe: listener => {
        changeMedia = listener;
        return () => undefined;
      },
    },
    settings: {
      get: () => Promise.resolve(themesDocument()),
      subscribe: () => () => undefined,
    },
  });
  const preloader = new MediaPreloader(api);
  await vi.waitFor(() => expect(loads.length).toBeGreaterThan(0));
  return {preloader, document};
}

async function finishAll(): Promise<void> {
  for (let guard = 0; guard < 50 && finishes.length > 0; guard += 1) {
    finishes.splice(0).forEach(finish => finish());
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

function own() {
  return loads.filter(id => /^\d$/u.test(id));
}

it('loads the pictures of the service one after another, the next ones first', async () => {
  const {preloader} = await setup({
    one: [slide(1, media(1)), slide(2, media(2))],
    two: [slide(3, media(3))],
  });
  expect(loads).toHaveLength(1);
  await finishAll();
  expect(own()).toEqual(['1', '2', '3']);
  preloader.dispose();
});

it('goes on from the slide that is live', async () => {
  const {preloader} = await setup({
    one: [slide(1, media(1))],
    two: [slide(2, media(2)), slide(3, media(3))],
  });
  preloader.request({itemId: 'two', index: 1});
  await finishAll();
  expect(own()).toEqual(['1', '3', '2']);
  preloader.dispose();
});

it('does not load a picture twice, and not one that failed again', async () => {
  const {preloader} = await setup({
    one: [slide(1, media(1)), slide(2, media(1)), slide(3, media(2))],
  });
  failures[0]?.(new Error('Invented failure'));
  await vi.waitFor(() => expect(own()).toEqual(['1', '2']));
  await finishAll();
  preloader.request({itemId: 'one', index: 0});
  await finishAll();
  expect(own()).toEqual(['1', '2']);
  preloader.dispose();
});

it('loads nothing more once it is disposed', async () => {
  const {preloader} = await setup({
    one: [slide(1, media(1)), slide(2, media(2))],
  });
  preloader.dispose();
  await finishAll();
  expect(own()).toEqual(['1']);
});

it('tries a picture that failed again once the media list changes, as when its file is put back', async () => {
  const {preloader, document} = await setup({
    one: [slide(1, media(1)), slide(2, media(2))],
  });
  failures[0]?.(new Error('Invented failure'));
  await vi.waitFor(() => expect(own()).toEqual(['1', '2']));
  await finishAll();
  changeMedia({...document, revision: 2});
  await vi.waitFor(() => expect(own()).toEqual(['1', '2', '1']));
  await finishAll();
  preloader.dispose();
});

/** Videos that load at once, naming each one a player started on. */
function playableVideos(): string[] {
  const played: string[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    const source = this.getAttribute('src');
    if (source === null) return;
    played.push(source.slice(-12).replace(/^0+/u, ''));
    queueMicrotask(() => {
      this.onloadeddata?.call(this, new Event('loadeddata'));
    });
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  return played;
}

it('keeps only the next four videos loaded, since players are scarce', async () => {
  const played = playableVideos();
  const clips = [1, 2, 3, 4, 5, 6].map(media);
  const {preloader} = await setup(
    {
      one: clips.map((id, index) => slide(index + 1, id)),
      two: [slide(7, media(7))],
    },
    clips,
  );
  await finishAll();
  expect(played).toEqual(['1', '2', '3', '4']);
  expect(own()).toEqual(['7']);
  preloader.dispose();
});

it('waits for the media list before it loads, so a video is never taken for a picture', async () => {
  const played = playableVideos();
  const clip = media(1);
  const {preloader} = await setup({one: [slide(1, clip), slide(2, media(2))]}, [
    clip,
  ]);
  await finishAll();
  expect(played).toEqual(['1']);
  expect(own()).toEqual(['2']);
  preloader.dispose();
});
