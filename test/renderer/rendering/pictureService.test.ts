import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {
  PictureService,
  type PictureSpec,
} from '@renderer/rendering/pictures/pictureService';

const mocks = vi.hoisted(() => ({
  ready: false,
  dispose: vi.fn(),
  incomplete: vi.fn(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render(): void {}
    dispose = mocks.dispose;
    revealIncomplete = mocks.incomplete;
  },
}));
vi.mock('@renderer/rendering/fontsLoading', () => ({
  fontsLoading: () => false,
  fontsStamp: () => 'fonts',
  previewReady: () => mocks.ready,
}));
vi.mock('@renderer/rendering/previewMedia', () => ({
  openPreviewMedia: () => undefined,
}));

const screen = createScreenId('00000000-0000-4000-8000-000000000001');
const spec: PictureSpec = {
  layers: emptyLayers(),
  appearance: {
    screen: {id: screen, kind: 'audience', method: 'fullscreen'},
    theme: {
      themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
      revision: 0,
      missing: [],
      sourceScreenId: screen,
      layout: {mode: {kind: 'own'}, elements: []},
      emptyColor: '#000000',
      item: null,
    },
    background: '#000000',
    checker: false,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', {userAgent: 'Chrome'});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  mocks.ready = false;
  mocks.dispose.mockClear();
  mocks.incomplete.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('waits beyond the output deadline for a complete import picture', async () => {
  const service = new PictureService({waitForReady: true});
  const drawing = service.whenDrawn(spec);
  await vi.advanceTimersByTimeAsync(OUTPUT_REVEAL_DEADLINE_MS + 100);
  expect(mocks.incomplete).not.toHaveBeenCalled();
  let finished = false;
  const observed = drawing.then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  mocks.ready = true;
  await vi.advanceTimersByTimeAsync(32);
  await expect(observed).resolves.toBeUndefined();
  service.reset();
  expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('disposes a pending import picture when its owner cancels', () => {
  const service = new PictureService({waitForReady: true});
  const pending = service.whenDrawn(spec);
  service.reset();
  expect(pending).toBeInstanceOf(Promise);
  expect(mocks.dispose).toHaveBeenCalledOnce();
});
