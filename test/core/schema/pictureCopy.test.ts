import {describe, expect, it} from 'vitest';
import {parsePictureRequest, parsePictureReply} from '@core/schema/pictureCopy';

const request = {
  id: 1,
  source: 'llp-media://media/picture',
  width: 448,
  height: 256,
  fit: 'cover',
};

describe('picture worker messages', () => {
  it('accepts bounded picture sizes and blob replies', () => {
    expect(parsePictureRequest(request).ok).toBe(true);
    expect(
      parsePictureReply({
        id: 1,
        picture: {blob: new Blob(), width: 448, height: 256},
      }).ok,
    ).toBe(true);
  });

  it.each([
    {width: 0},
    {height: 8193},
    {width: NaN},
    {width: 1.5},
    {source: 'https://outside/picture'},
    {fit: 'unknown'},
    {id: -1},
  ])('refuses an invalid request %j', changes => {
    expect(parsePictureRequest({...request, ...changes}).ok).toBe(false);
  });

  it('refuses a reply that is not a picture URL', () => {
    expect(
      parsePictureReply({
        id: 1,
        picture: {blob: 'not a blob', width: 1, height: 1},
      }).ok,
    ).toBe(false);
  });
});
