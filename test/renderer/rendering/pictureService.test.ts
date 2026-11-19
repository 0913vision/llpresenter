import {afterEach, beforeEach, expect, it, onTestFinished, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {
  PictureService,
  type PictureSpec,
} from '@renderer/rendering/pictures/pictureService';
import {LocalPicturePainter} from '@renderer/rendering/pictures/localPicturePainter';

const mocks = vi.hoisted(() => ({
  ready: false,
  render: vi.fn(),
  dispose: vi.fn(),
  incomplete: vi.fn(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = mocks.render;
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
const canvasContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(LocalPicturePainter, 'available').mockReturnValue(true);
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      drawElementImage: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    }),
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1920);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1080);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback =>
    callback(new Blob(['picture'])),
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = vi.fn(() => 'blob:import');
      static override revokeObjectURL = vi.fn();
    },
  );
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = vi.fn().mockResolvedValue(undefined);
    },
  );
  mocks.ready = false;
  mocks.render.mockClear();
  mocks.dispose.mockClear();
  mocks.incomplete.mockClear();
});
afterEach(() => {
  if (canvasContext !== undefined) {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      'getContext',
      canvasContext,
    );
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
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
  document.querySelector('body > canvas')?.dispatchEvent(new Event('paint'));
  await expect(drawing).resolves.toBe(true);
  await observed;
  service.reset();
  expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('disposes a pending import picture when its owner cancels', async () => {
  const service = new PictureService({waitForReady: true});
  const pending = service.whenDrawn(spec);
  await vi.advanceTimersByTimeAsync(0);
  service.reset();
  await expect(pending).resolves.toBe(false);
  expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('draws a requested handoff before the pending visible pictures', async () => {
  const paint = vi.fn().mockResolvedValue(new Uint8Array([0xff]));
  vi.stubGlobal('llp', {
    picture: {paint},
    media: {
      get: vi.fn().mockResolvedValue({revision: 0, value: {items: []}}),
      subscribe: vi.fn(),
    },
    fonts: {
      snapshot: vi.fn().mockRejectedValue(new Error('No font catalog')),
      subscribe: vi.fn(),
    },
  });
  const service = new PictureService();
  const queued = {
    ...spec,
    appearance: {...spec.appearance, background: '#123456'},
  };
  service.request(queued, service.inputs(queued));
  const ready = service.whenDrawn(spec, 'requested:0');

  await expect(ready).resolves.toBe(true);
  expect(paint).toHaveBeenNthCalledWith(1, expect.objectContaining({spec}));
  await vi.advanceTimersByTimeAsync(0);
  expect(paint).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({spec: queued}),
  );
});

it('publishes the edited picture inside the source paint event', async () => {
  const paint = vi.fn();
  vi.stubGlobal('llp', {
    picture: {paint},
    media: {
      get: vi.fn().mockResolvedValue({revision: 0, value: {items: []}}),
      subscribe: vi.fn(),
    },
    fonts: {
      snapshot: vi.fn().mockRejectedValue(new Error('No font catalog')),
      subscribe: vi.fn(),
    },
  });
  const service = new PictureService();
  const slide = {itemId: 'song', position: 0, label: null, lines: ['첫 줄']};
  const picture = {...spec, layers: {...spec.layers, slide}};
  const lines = ['첫 줄을 고침'];
  const next = {
    ...picture,
    layers: {...picture.layers, slide: {...slide, lines}},
  };
  service.prepareEditedLyrics(picture, lines);
  expect(mocks.render.mock.calls[0]?.[0]).toEqual(next.layers);
  const entry = service.request(next, service.inputs(next));
  await vi.advanceTimersByTimeAsync(0);
  const canvas = document.querySelector('body > canvas');
  if (canvas === null) throw Error('Missing editor painter');
  onTestFinished(() => canvas.remove());
  expect(entry.done).toBe(false);
  mocks.ready = true;
  canvas.dispatchEvent(new Event('paint'));
  expect(entry.done).toBe(true);
  expect(entry.image?.source).toBeInstanceOf(HTMLCanvasElement);
  expect(paint).not.toHaveBeenCalled();
});
