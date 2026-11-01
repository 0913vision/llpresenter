import {beforeEach, vi} from 'vitest';
import type {MediaLayer} from '@core/live/state';
import {
  BackgroundLayerView,
  type RenderMode,
} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';

export const WARM_LIGHT: MediaLayer = {
  mediaId: 'warm-light',
  loop: true,
  startedAt: Date.now(),
};
export const STILL_WATER: MediaLayer = {
  mediaId: 'still-water',
  loop: true,
  startedAt: Date.now(),
};

export const urlOf = (mediaId: string): string =>
  `https://media.test/${mediaId}.mp4`;

let playSpy: {mock: {contexts: unknown[]}} | undefined;
let readyState: number = HTMLMediaElement.HAVE_ENOUGH_DATA;

beforeEach(() => {
  readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
  playSpy = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockReturnValue(
    undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(
    () => readyState,
  );
});

export function setUp(mode: RenderMode = 'output') {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new BackgroundLayerView(parent, {
    mediaUrl: urlOf,
    onError,
    mode,
  });
  const [first, second] = [...parent.querySelectorAll('video')];
  if (first === undefined || second === undefined) {
    throw new Error('expected two video elements');
  }
  return {parent, view, onError, videos: [first, second] as const};
}

export function isShown(element: HTMLElement): boolean {
  return element.classList.contains(classes.shown);
}

export function playsOf(video: HTMLVideoElement): number {
  if (playSpy === undefined) throw new Error('The play spy is not installed');
  return playSpy.mock.contexts.filter(context => context === video).length;
}

export function setReadyState(value: number): void {
  readyState = value;
}
