import {afterEach, beforeEach, expect, it, onTestFinished, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {pictureKey} from '@core/output/pictureKey';
import {parsePictureRequest} from '@core/schema/picture';
import {
  parseOutputStatuses,
  type OutputStatuses,
} from '@core/schema/outputStatus';
import {
  drawPicture,
  pictureBounds,
} from '@renderer/rendering/pictures/drawPicture';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
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
      fillRect: vi.fn(),
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

it('reuses an imported slide picture from the shared cache', async () => {
  const peek = vi
    .fn()
    .mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  vi.stubGlobal('llp', {picture: {reserve: () => false, peek}});
  const service = new PictureService({waitForReady: true});
  const ready = service.whenDrawn(spec);
  await vi.advanceTimersByTimeAsync(0);
  await expect(ready).resolves.toBe(true);
  expect(peek).toHaveBeenCalledOnce();
  expect(mocks.render).not.toHaveBeenCalled();
  service.reset();
});

it('stores a newly drawn import picture in the shared cache', async () => {
  const remember = vi.fn();
  const release = vi.fn();
  vi.stubGlobal('llp', {picture: {reserve: () => true, remember, release}});
  const service = new PictureService({waitForReady: true});
  const ready = service.whenDrawn(spec);
  await vi.advanceTimersByTimeAsync(0);
  const canvas = document.querySelector('body > canvas');
  if (canvas === null) throw Error('Missing import painter');
  onTestFinished(() => canvas.remove());
  mocks.ready = true;
  canvas.dispatchEvent(new Event('paint'));
  await vi.advanceTimersByTimeAsync(0);
  await expect(ready).resolves.toBe(true);
  expect(remember).toHaveBeenCalledOnce();
  expect(release).not.toHaveBeenCalled();
  service.reset();
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

it('reports a display decode failure while keeping the cached source available', async () => {
  const decode = vi
    .fn<() => Promise<void>>()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValue(new Error('Display refused to decode'));
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = decode;
    },
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('llp', {
    picture: {paint: vi.fn().mockResolvedValue(new Uint8Array([0xff]))},
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
  await expect(service.whenDrawn(spec, 'requested:0')).resolves.toBe(false);
  await expect(service.whenDrawn(spec)).resolves.toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(decode).toHaveBeenCalledTimes(2);
});

it('publishes the edited picture inside the source paint event', async () => {
  const paint = vi.fn();
  vi.stubGlobal('llp', {
    picture: {paint, reserve: () => true, remember: vi.fn(), release: vi.fn()},
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
  service.inputs(picture);
  await vi.advanceTimersByTimeAsync(0);
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

it('waits for the shared picture when another window already owns the draw', async () => {
  const paint = vi.fn().mockResolvedValue(new Uint8Array([0xff]));
  const reserve = vi.fn().mockReturnValue(false);
  vi.stubGlobal('llp', {
    picture: {paint, reserve},
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
  const slide = {itemId: 'song', position: 0, label: null, lines: ['Before']};
  const picture = {...spec, layers: {...spec.layers, slide}};
  service.inputs(picture);
  await vi.advanceTimersByTimeAsync(0);
  service.prepareEditedLyrics(picture, ['After']);
  await vi.advanceTimersByTimeAsync(0);
  expect(reserve).toHaveBeenCalledOnce();
  expect(paint).toHaveBeenCalledOnce();
  expect(mocks.render).not.toHaveBeenCalled();
});

it('keeps pictures from distinct output screens in separate cache entries', () => {
  const otherScreen = createScreenId('00000000-0000-4000-8000-000000000003');
  const other = {
    ...spec,
    appearance: {
      ...spec.appearance,
      screen: {...spec.appearance.screen, id: otherScreen},
    },
  };
  expect(pictureKey(other)).not.toBe(pictureKey(spec));
  expect(pictureKey({...spec})).toBe(pictureKey(spec));
});

it('invalidates a screen picture when its configured size changes', () => {
  const sized = {
    ...spec,
    appearance: {
      ...spec.appearance,
      screen: {
        ...spec.appearance.screen,
        pictureSize: {width: 1920, height: 1080},
      },
    },
  };
  const resized = {
    ...sized,
    appearance: {
      ...sized.appearance,
      screen: {
        ...sized.appearance.screen,
        pictureSize: {width: 1280, height: 720},
      },
    },
  };
  expect(pictureKey(sized)).not.toBe(pictureKey(resized));
  expect(parsePictureRequest({spec: sized, inputs: ''}).ok).toBe(true);
  expect(
    parsePictureRequest({
      spec: {
        ...sized,
        appearance: {
          ...sized.appearance,
          screen: {
            ...sized.appearance.screen,
            pictureSize: {width: -1, height: 720},
          },
        },
      },
      inputs: '',
    }).ok,
  ).toBe(false);
});

it('fits the configured output aspect ratio inside cached pictures', () => {
  expect(pictureBounds(undefined)).toEqual({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  });
  expect(pictureBounds({width: 1024, height: 768})).toEqual({
    x: 240,
    y: 0,
    width: 1440,
    height: 1080,
  });
  expect(pictureBounds({width: 2560, height: 1080})).toEqual({
    x: 0,
    y: 135,
    width: 1920,
    height: 810,
  });
});

it('composes an edited 4:3 picture inside the shared canvas', async () => {
  const drawElementImage = vi.fn();
  const fillRect = vi.fn();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      drawElementImage,
      fillRect,
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    }),
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440);
  mocks.ready = true;
  const painter = new LocalPicturePainter();
  const picture = painter.paint({
    ...spec,
    appearance: {
      ...spec.appearance,
      screen: {
        ...spec.appearance.screen,
        pictureSize: {width: 1024, height: 768},
      },
    },
  });
  document.querySelector('body > canvas')?.dispatchEvent(new Event('paint'));
  await expect(picture).resolves.toBeInstanceOf(HTMLCanvasElement);
  expect(fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
  expect(drawElementImage).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    240,
    0,
  );
  painter.dispose();
});

it('separates split editor pictures by their fixed line budget', () => {
  const picture = {
    ...spec,
    appearance: {
      ...spec.appearance,
      biblePreview: {elementId: 'verse', maxLines: 3},
    },
  };
  const changed = {
    ...picture,
    appearance: {
      ...picture.appearance,
      biblePreview: {elementId: 'verse', maxLines: 4},
    },
  };
  expect(pictureKey(picture)).not.toBe(pictureKey(changed));
  expect(parsePictureRequest({spec: picture, inputs: ''}).ok).toBe(true);
  expect(
    parsePictureRequest({
      spec: {
        ...picture,
        appearance: {
          ...picture.appearance,
          biblePreview: {elementId: 'verse', maxLines: -1},
        },
      },
      inputs: '',
    }).ok,
  ).toBe(false);
});

it('passes audience sizing and stage label preferences into cached stage drawings', () => {
  const audience = {
    screen: spec.appearance.screen,
    theme: spec.appearance.theme,
  };
  const stage = {
    ...spec,
    appearance: {
      ...spec.appearance,
      screen: {...spec.appearance.screen, kind: 'stage' as const},
      audience,
      stageLyricLabelPosition: 'line' as const,
    },
  };
  expect(parsePictureRequest({spec: stage, inputs: ''}).ok).toBe(true);
  const host = document.createElement('div');
  const renderer = new OutputRenderer(host, {
    textStyle: DEFAULT_TEXT_STYLE,
    mediaUrl: id => id,
    onError: vi.fn(),
  });
  drawPicture(renderer, host, stage);
  expect(mocks.render).toHaveBeenLastCalledWith(
    stage.layers,
    expect.objectContaining({audience, stageLyricLabelPosition: 'line'}),
  );
});

it('shares cache entries when the default stage label option is implicit', () => {
  const stage = {
    ...spec,
    appearance: {
      ...spec.appearance,
      screen: {...spec.appearance.screen, kind: 'stage' as const},
    },
  };
  const line = {
    ...stage,
    appearance: {...stage.appearance, stageLyricLabelPosition: 'line' as const},
  };
  const off = {
    ...stage,
    appearance: {...stage.appearance, stageLyricLabelPosition: 'off' as const},
  };
  expect(pictureKey(stage)).toBe(pictureKey(line));
  expect(pictureKey(stage)).not.toBe(pictureKey(off));
  expect(pictureKey(spec)).toBe(
    pictureKey({
      ...spec,
      appearance: {...spec.appearance, stageLyricLabelPosition: 'line'},
    }),
  );
});

it('uses actual output size for shared cache keys and redraws after resizing', () => {
  let receive: (value: OutputStatuses) => void = () => undefined;
  vi.stubGlobal('llp', {
    picture: {paint: vi.fn()},
    media: {
      get: vi.fn().mockResolvedValue({revision: 0, value: {items: []}}),
      subscribe: vi.fn(),
    },
    fonts: {
      snapshot: vi.fn().mockRejectedValue(new Error('No fonts')),
      subscribe: vi.fn(),
    },
    output: {
      getStatus: vi.fn().mockResolvedValue({}),
      subscribeStatus: (listener: (value: OutputStatuses) => void) => {
        receive = listener;
        return () => undefined;
      },
    },
  });
  const service = new PictureService();
  service.inputs(spec);
  const status = (width: number, height: number): OutputStatuses => {
    const parsed = parseOutputStatuses({
      [screen]: {
        placement: 'window',
        renderer: 'running',
        fps: null,
        fpsLow: false,
        contentSize: {width, height},
      },
    });
    if (!parsed.ok) throw new Error('Invalid output status');
    return parsed.value;
  };
  receive(status(1280, 720));
  const first = service.request(spec, service.inputs(spec));
  expect(first.spec.appearance.screen.pictureSize).toEqual({
    width: 1280,
    height: 720,
  });
  receive(status(1024, 768));
  const resized = service.request(spec, service.inputs(spec));
  expect(resized).not.toBe(first);
  expect(resized.spec.appearance.screen.pictureSize).toEqual({
    width: 1024,
    height: 768,
  });
  receive(status(1024, 768));
  expect(service.request(spec, service.inputs(spec))).toBe(resized);
  const off = parseOutputStatuses({
    [screen]: {placement: 'off', renderer: 'running', fps: null, fpsLow: false},
  });
  if (!off.ok) throw new Error('Invalid off status');
  receive(off.value);
  expect(service.screenSize(spec.appearance.screen)).toBeUndefined();
});
