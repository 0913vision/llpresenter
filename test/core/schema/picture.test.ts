import {describe, expect, it} from 'vitest';
import {parsePictureRequest, parsePictureUpload} from '@core/schema/picture';

const id = '00000000-0000-4000-8000-000000000001';
const request = {
  inputs: 'font and media revisions',
  spec: {
    layers: {media: null, slide: null, prop: null, audio: null, message: null},
    appearance: {
      screen: {id, kind: 'audience'},
      theme: {
        themeId: id,
        revision: 0,
        missing: [],
        item: null,
        sourceScreenId: id,
        layout: {mode: {kind: 'own'}, elements: []},
        emptyColor: '#000000',
      },
      background: '#000000',
      checker: false,
    },
  },
};

describe('picture request', () => {
  it('accepts a bounded picture', () => {
    expect(parsePictureRequest(request)).toEqual({ok: true, value: request});
    const retry = {...request, repaint: true};
    expect(parsePictureRequest(retry)).toEqual({ok: true, value: retry});
  });

  it('rejects malformed and oversized fields', () => {
    for (const value of [
      null,
      {},
      {spec: null},
      {...request, inputs: 'x'.repeat(100_001)},
      {...request, repaint: false},
      {
        spec: {
          ...request.spec,
          appearance: {
            ...request.spec.appearance,
            background: 'x'.repeat(4097),
          },
        },
      },
    ]) {
      expect(parsePictureRequest(value).ok).toBe(false);
    }
  });

  it('checks the encoded editor source and its picture inputs', () => {
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect(parsePictureUpload({picture: request, image}).ok).toBe(true);
    expect(parsePictureUpload({picture: request, image: [...image]}).ok).toBe(
      false,
    );
    expect(
      parsePictureUpload({picture: request, image: new Uint8Array(0)}).ok,
    ).toBe(false);
    expect(parsePictureUpload({picture: {}, image}).ok).toBe(false);
  });
});
