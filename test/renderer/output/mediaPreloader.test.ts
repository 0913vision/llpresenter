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

const media = (number: number) =>
  createMediaId(`00000000-0000-4000-8000-${String(number).padStart(12, '0')}`);
const slide = (number: number, id: MediaId): Slide =>
  lyricsSlide(number, '가사', {background: {kind: 'media', media: id}});

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

async function setup(decks: Readonly<Record<string, readonly Slide[]>>) {
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
      items: [],
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
      subscribe: () => () => undefined,
    },
    settings: {
      get: () => Promise.resolve(themesDocument()),
      subscribe: () => () => undefined,
    },
  });
  const preloader = new MediaPreloader(api);
  await vi.waitFor(() => expect(loads.length).toBeGreaterThan(0));
  return preloader;
}

async function finishAll(): Promise<void> {
  for (let guard = 0; guard < 50 && finishes.length > 0; guard += 1) {
    finishes.splice(0).forEach(finish => finish());
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

const own = () => loads.filter(id => /^\d$/u.test(id));

it('loads the pictures of the service one after another, the next ones first', async () => {
  const preloader = await setup({
    one: [slide(1, media(1)), slide(2, media(2))],
    two: [slide(3, media(3))],
  });
  expect(loads).toHaveLength(1);
  await finishAll();
  expect(own()).toEqual(['1', '2', '3']);
  preloader.dispose();
});

it('goes on from the slide that is live', async () => {
  const preloader = await setup({
    one: [slide(1, media(1))],
    two: [slide(2, media(2)), slide(3, media(3))],
  });
  preloader.request({itemId: 'two', index: 1});
  await finishAll();
  expect(own()).toEqual(['1', '3', '2']);
  preloader.dispose();
});

it('does not load a picture twice, and not one that failed again', async () => {
  const preloader = await setup({
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
  const preloader = await setup({
    one: [slide(1, media(1)), slide(2, media(2))],
  });
  preloader.dispose();
  await finishAll();
  expect(own()).toEqual(['1']);
});
