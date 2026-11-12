import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {PowerPointScene} from '@core/songs/powerpointLayers';
import {powerpointPictureFilters} from '@core/songs/powerpointPictureFilters';
import {composePowerPointBackground} from '@renderer/features/songs/import/composePowerPointBackground';

vi.mock('@core/songs/powerpointPictureFilters', () => ({
  powerpointPictureFilters: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(powerpointPictureFilters).mockReturnValue([
    {kind: 'grayscale', amount: 1},
    {kind: 'contrast', amount: 0.8},
    {kind: 'invert', amount: 1},
    {kind: 'brightness', amount: 0.8},
    {kind: 'invert', amount: 1},
  ]);
});

function mockCanvas(alpha: number) {
  const linearGradient = {addColorStop: vi.fn()};
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    roundRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([0, 0, 0, alpha]),
    })),
    filter: '',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    createLinearGradient: vi.fn((...coordinates: number[]) => ({
      ...linearGradient,
      coordinates,
    })),
  };
  const convertToBlob = vi.fn(async () => ({
    arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
  }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width = 1920;
      height = 1080;
      getContext() {
        return context;
      }
      convertToBlob = convertToBlob;
    },
  );
  return {context, convertToBlob};
}
const picture: PowerPointScene = {
  key: 'a'.repeat(64),
  skipped: 0,
  layers: [
    {
      kind: 'picture',
      id: 'p',
      matrix: {a: -1920, b: 0, c: 0, d: 1080, e: 1920, f: 0},
      part: 'p.png',
      crop: {left: 0.1, top: -0.1, right: 0.2, bottom: 0},
      stretch: {left: 0, top: 0, right: 0.25, bottom: 0},
      alpha: 0.5,
      brightness: 0.2,
      contrast: -0.2,
      grayscale: true,
    },
  ],
  pictures: [{part: 'p.png', mime: 'image/png', bytes: new Uint8Array([1])}],
};
afterEach(() => vi.unstubAllGlobals());

describe('PowerPoint canvas composition', () => {
  it('applies picture geometry, cropping and effects, then releases its bitmap', async () => {
    const {context, convertToBlob} = mockCanvas(255);
    const bitmap = {width: 100, height: 100, close: vi.fn()};
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const result = await composePowerPointBackground(picture);
    expect(context.setTransform).toHaveBeenCalledWith(
      -1920,
      0,
      0,
      1080,
      1920,
      0,
    );
    expect(context.drawImage).toHaveBeenCalledWith(
      bitmap,
      10,
      -10,
      70,
      110.00000000000001,
      0,
      0,
      0.75,
      1,
    );
    expect(context.filter).toBe(
      'grayscale(1) contrast(0.8) invert(1) brightness(0.8) invert(1)',
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.92,
    });
    expect(result.mime).toBe('image/jpeg');
  });

  it('crops an asymmetric rectangle in bitmap pixels before mirroring it horizontally', async () => {
    const {context} = mockCanvas(255);
    vi.mocked(powerpointPictureFilters).mockReturnValueOnce([]);
    const bitmap = {width: 4000, height: 3000, close: vi.fn()};
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const cropped: PowerPointScene = {
      ...picture,
      layers: [
        {
          kind: 'picture',
          id: 'crop',
          matrix: {a: -1920, b: 0, c: 0, d: 1080, e: 1920, f: 0},
          part: 'p.png',
          crop: {left: 0.2, top: 0.25, right: 0, bottom: 0},
          stretch: {left: 0, top: 0, right: 0, bottom: 0},
          alpha: 1,
          brightness: 0,
          contrast: 0,
          grayscale: false,
        },
      ],
    };
    await composePowerPointBackground(cropped);
    expect(context.drawImage).toHaveBeenCalledWith(
      bitmap,
      800,
      750,
      3200,
      2250,
      0,
      0,
      1,
      1,
    );
    expect(context.setTransform).toHaveBeenCalledWith(
      -1920,
      0,
      0,
      1080,
      1920,
      0,
    );
    expect(context.filter).toBe('none');
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe('high');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('keeps an unscaled 45 degree gradient diagonal in physical pixels on a 2:1 shape', async () => {
    const {context} = mockCanvas(255);
    const scene: PowerPointScene = {
      key: 'a'.repeat(64),
      skipped: 0,
      pictures: [],
      layers: [
        {
          kind: 'shape',
          id: 'gradient',
          matrix: {a: 200, b: 0, c: 0, d: 100, e: 0, f: 0},
          geometry: 'rect',
          radius: 0,
          outline: null,
          fill: {
            kind: 'gradient',
            angle: 45,
            scaled: false,
            radial: false,
            focus: {left: 0, top: 0, right: 0, bottom: 0},
            stops: [
              {position: 0, color: {r: 0, g: 0, b: 0, alpha: 1}},
              {position: 1, color: {r: 1, g: 1, b: 1, alpha: 1}},
            ],
          },
        },
      ],
    };
    await composePowerPointBackground(scene);
    expect(context.createLinearGradient).toHaveBeenCalledOnce();
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] =
      context.createLinearGradient.mock.calls[0] ?? [];
    const horizontalRate = (x1 - x0) / 200;
    const verticalRate = (y1 - y0) / 100;
    expect(verticalRate / horizontalRate).toBeCloseTo(1, 10);
  });

  it('encodes PNG when transparency reaches the edge', async () => {
    const {convertToBlob} = mockCanvas(0);
    const result = await composePowerPointBackground({
      ...picture,
      layers: [],
      pictures: [],
    });
    expect(result.mime).toBe('image/png');
    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/png',
      quality: 0.92,
    });
  });

  it('releases the bitmap and restores state when drawing fails', async () => {
    const {context} = mockCanvas(255);
    const bitmap = {width: 100, height: 100, close: vi.fn()};
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    context.drawImage.mockImplementation(() => {
      throw new Error('draw failed');
    });
    await expect(composePowerPointBackground(picture)).rejects.toThrow(
      'draw failed',
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
  });
});
