import {describe, expect, it} from 'vitest';
import {
  parsePowerPointBackgroundRequest,
  parsePowerPointReadResult,
  parsePowerPointReleaseRequest,
  parsePowerPointMatchResult,
  parsePowerPointScene,
} from '@core/schema/powerpointImport';

describe('PowerPoint import IPC', () => {
  it('accepts a valid retained deck and selection', () => {
    expect(
      parsePowerPointReadResult({
        ok: true,
        value: {
          fileName: 'a.pptx',
          slides: [
            {
              number: 1,
              shapes: [{body: true, lines: ['test']}],
              background: null,
            },
          ],
        },
      }).ok,
    ).toBe(true);
    expect(parsePowerPointBackgroundRequest({index: 0}).ok).toBe(true);
    const release = parsePowerPointReleaseRequest({path: 'C:/temp/image.png'});
    expect(release.ok).toBe(true);
    expect(parsePowerPointMatchResult(null).ok).toBe(true);
    expect(
      parsePowerPointMatchResult('00000000-0000-4000-8000-000000000123').ok,
    ).toBe(true);
  });
  it('rejects invalid slide numbers and background selections', () => {
    expect(
      parsePowerPointReadResult({
        ok: true,
        value: {
          fileName: 'a.pptx',
          slides: [{number: 0, shapes: [], background: null}],
        },
      }).ok,
    ).toBe(false);
    expect(parsePowerPointBackgroundRequest({index: -1}).ok).toBe(false);
    expect(parsePowerPointBackgroundRequest({index: 1.5}).ok).toBe(false);
    expect(parsePowerPointReleaseRequest({path: ''}).ok).toBe(false);
    expect(parsePowerPointReleaseRequest({path: 3}).ok).toBe(false);
    expect(parsePowerPointMatchResult('not-a-media-id').ok).toBe(false);
  });
});

describe('PowerPoint drawing data IPC', () => {
  const matrix = {a: 1920, b: 0, c: 0, d: 1080, e: 0, f: 0};
  const zero = {left: 0, top: 0, right: 0, bottom: 0};
  const color = {r: 0, g: 0.5, b: 1, alpha: 0.5};
  const picture = {
    kind: 'picture',
    id: 'p',
    matrix,
    part: 'p.png',
    crop: {...zero, left: -0.2},
    stretch: zero,
    alpha: 1,
    brightness: 0.2,
    contrast: -0.1,
    grayscale: true,
  };
  const shape = {
    kind: 'shape',
    id: 's',
    matrix,
    geometry: 'ellipse',
    radius: 0,
    fill: {
      kind: 'gradient',
      angle: 90,
      scaled: false,
      radial: false,
      focus: zero,
      stops: [
        {position: 0, color},
        {position: 1, color},
      ],
    },
    outline: null,
  };
  const scene = {
    key: 'a'.repeat(64),
    layers: [picture, shape],
    skipped: 0,
    pictures: [
      {
        part: 'p.png',
        mime: 'image/png',
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
    ],
  };

  it('accepts resolved drawing layers and typed picture bytes', () => {
    expect(parsePowerPointScene(scene).ok).toBe(true);
    expect(
      parsePowerPointBackgroundRequest({
        index: 1,
        image: {mime: 'image/jpeg', bytes: new Uint8Array([255, 216])},
      }).ok,
    ).toBe(true);
  });

  it('rejects excess layers, missing parts, repeated parts and invalid bytes', () => {
    expect(
      parsePowerPointScene({
        ...scene,
        layers: Array.from({length: 65}, () => shape),
      }).ok,
    ).toBe(false);
    expect(parsePowerPointScene({...scene, pictures: []}).ok).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        pictures: [...scene.pictures, ...scene.pictures],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        pictures: [{...scene.pictures[0], bytes: [1, 2]}],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        pictures: [{...scene.pictures[0], bytes: new Uint8Array(0)}],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        pictures: [
          {...scene.pictures[0], bytes: new Uint8Array(32 * 1024 * 1024 + 1)},
        ],
      }).ok,
    ).toBe(false);
  });

  it('rejects nonfinite geometry, invalid colors, unknown shapes and unordered stops', () => {
    expect(
      parsePowerPointScene({
        ...scene,
        layers: [{...picture, matrix: {...matrix, a: Infinity}}],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({...scene, layers: [{...picture, alpha: -0.1}]}).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        layers: [{...shape, geometry: 'triangle'}],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        layers: [
          {
            ...shape,
            fill: {
              ...shape.fill,
              stops: [
                {position: 1, color},
                {position: 0, color},
              ],
            },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      parsePowerPointScene({
        ...scene,
        layers: [{...shape, fill: {kind: 'solid', color: {...color, r: 2}}}],
      }).ok,
    ).toBe(false);
  });
});
